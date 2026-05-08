// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useAuth } from "@/lib/AuthContext";
import { getTopicGuardResponse, sanitizeAiText } from "@/lib/aiTopicGuard";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, LayoutDashboard, Play, Bot, ClipboardList, Dumbbell, GraduationCap,
  BarChart3, FileText, Globe, BookOpen, HelpCircle, Settings, ChevronRight, Link2,
  ChevronDown, Bell, User, PenSquare, TrendingUp, UserCircle, Users, Route, MessageCircle, Send, X, ChevronLeft
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
    label: "Intelligence Hub",
    icon: BarChart3,
    defaultOpen: false,
    items: [
      { label: "Behavioral Metrics", page: "BehavioralMetrics", icon: BarChart3 },
      { label: "Performance Analytics", page: "PerformanceAnalytics", icon: TrendingUp },
      { label: "Data and Reports", page: "DataReports", icon: FileText },
    ],
  },
  {
    label: "Enablement Library",
    icon: Globe,
    defaultOpen: false,
    items: [
      { label: "Selling and Coaching Frameworks", page: "Frameworks", icon: Globe },
      { label: "Customization & Integration", page: "CustomizationIntegration", icon: Link2 },
      { label: "Knowledge Base", page: "KnowledgeBase", icon: BookOpen },
    ],
  },
  {
    label: "Manager Intervention",
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("reflectiv-sidebar-collapsed") === "true";
  });
  const [isDesktop, setIsDesktop] = useState(() => (typeof window === "undefined" ? true : window.innerWidth >= 768));
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
  const mobileOverlayOpen = sidebarOpen || assistantOpen;

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("app-color-mode", "light");
    window.dispatchEvent(new CustomEvent("app-color-mode-changed", { detail: "light" }));
  }, []);

  useEffect(() => {
    const syncSidebarMode = () => {
      setIsDesktop(window.innerWidth >= 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };

    syncSidebarMode();
    window.addEventListener("resize", syncSidebarMode);
    return () => window.removeEventListener("resize", syncSidebarMode);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("reflectiv-sidebar-collapsed", String(desktopSidebarCollapsed));
    }
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileOverlayOpen && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow || "";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOverlayOpen]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) setNotificationsOpen(false);
      if (assistantRef.current && !assistantRef.current.contains(e.target) && !e.target.closest("[data-chat-trigger='true']")) setAssistantOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setNotificationsOpen(false);
        setAssistantOpen(false);
        setSidebarOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleSection = (label) => {
    if (desktopSidebarCollapsed && isDesktop) return;
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const shouldShowCollapsedTooltips = desktopSidebarCollapsed && isDesktop;

  const renderCollapsedTooltip = (label, child) => {
    if (!shouldShowCollapsedTooltips) return child;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{child}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  };

  const handleNavToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setDesktopSidebarCollapsed((value) => !value);
      return;
    }

    setSidebarOpen((value) => !value);
  };

  const sendAssistantMessage = async () => {
    const text = assistantInput.trim();
    if (!text || assistantLoading) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...assistantMessages, userMsg];
    setAssistantMessages(newMessages);
    setAssistantInput("");

    const guardrailReply = getTopicGuardResponse(text, "platform");
    if (guardrailReply) {
      setAssistantMessages((prev) => [...prev, { role: "assistant", content: guardrailReply }]);
      return;
    }

    setAssistantLoading(true);

    try {
      const prompt = `You are Alora, the ReflectivAI Assistant. Answer platform navigation and usage questions in concise, polished, enterprise-grade guidance.\n\nConversation:\n${newMessages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n")}`;
      const res = await fetch("/api/llm/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 300 }),
      });
      const data = await res.json().catch(() => ({}));
      const responseText = sanitizeAiText(data?.response || data?.text || data?.content || "I couldn’t generate an answer right now. Please try again.");
      setAssistantMessages((prev) => [...prev, { role: "assistant", content: responseText }]);
    } catch {
      setAssistantMessages((prev) => [...prev, { role: "assistant", content: "Service is temporarily unavailable. Please try again." }]);
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <style>{`
        :root {
          --brand-navy: #1A334D;
          --brand-teal: #39ACAC;
          --brand-teal-light: #e6f7f7;
          --brand-pale-yellow: #fefce8;
          --brand-light-gray: #f0f4f8;
        }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #39ACAC44; border-radius: 4px; }
      `}</style>

      {mobileOverlayOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/45 md:hidden"
          onClick={() => {
            setSidebarOpen(false);
            setAssistantOpen(false);
          }}
          aria-label="Close open panel"
        />
      ) : null}

      <TooltipProvider delayDuration={120}>
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col border-r border-[#22405f] bg-[#1A334D] shadow-2xl transition-[width,transform] duration-200 ease-out md:sticky md:top-0 md:z-20 md:h-screen md:translate-x-0 md:shadow-none ${desktopSidebarCollapsed ? "md:w-16" : "w-72 md:w-60"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-hidden={!sidebarOpen && typeof window !== "undefined" ? window.innerWidth < 768 : undefined}
      >
        <div className={`flex items-center border-b border-[#22405f] p-4 ${desktopSidebarCollapsed ? "justify-center" : "gap-3"}`}>
          <div className="flex-shrink-0">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="20" fill="#1A334D" />
              <path d="M6 28 Q20 38 34 28" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <circle cx="20" cy="18" r="11" stroke="white" strokeWidth="1.8" fill="none" />
              <path d="M20 10 C24 14 24 22 20 26 C16 22 16 14 20 10Z" fill="white" />
            </svg>
          </div>
          {!desktopSidebarCollapsed ? (
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight tracking-tight">
                <span className="text-white">Reflectiv</span>
                <span className="text-[#39ACAC]">AI</span>
              </h1>
              <p className="-mt-0.5 text-[11px] text-white/65">Sales Enablement</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-[#22405f] px-2 py-3 md:px-3">
          <div className={`flex items-center rounded-xl border border-white/10 bg-white/10 ${desktopSidebarCollapsed ? "justify-center px-1.5 py-3" : "gap-2 px-3 py-2"}`} ref={userMenuRef}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
              {authUser?.name?.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "DU"}
            </div>
            {!desktopSidebarCollapsed ? (
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-white">{authUser?.name || "Demo User"}</div>
                <div className="truncate text-[11px] text-white/60">{authUser?.email || "demo@example.com"}</div>
              </div>
            ) : null}
            <button onClick={() => setUserMenuOpen((v) => !v)} className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white/70 transition hover:bg-white/10 hover:text-white ${desktopSidebarCollapsed ? "hidden" : ""}`} aria-label="Toggle user menu">
              <ChevronDown className={`h-4 w-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute right-4 mt-32 z-[60] w-48 rounded-2xl border border-slate-200 bg-white p-1 shadow-lg"
                >
                  <Link to={createPageUrl("ProfileSettings")} className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-slate-700 hover:bg-slate-50">
                    <UserCircle className="h-4 w-4" /> Profile Settings
                  </Link>
                  <button onClick={() => logout?.()} className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm text-red-600 hover:bg-red-50">
                    Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto px-2 py-4 md:px-3 ${desktopSidebarCollapsed ? "overflow-x-hidden" : ""}`}>
          {navSections.map((section) => (
            <div key={section.label} className="mb-1">
              {renderCollapsedTooltip(
                section.label,
                <button
                  onClick={() => toggleSection(section.label)}
                  className={`flex min-h-11 w-full items-center rounded-xl px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider transition-all duration-200 ${desktopSidebarCollapsed ? "justify-center" : "gap-3"} ${openSections[section.label] ? "text-white" : "text-white/50 hover:text-white/80"}`}
                  title={desktopSidebarCollapsed ? section.label : undefined}
                >
                  <section.icon className="h-4 w-4 flex-shrink-0" />
                  {!desktopSidebarCollapsed ? <span className="flex-1">{section.label}</span> : null}
                  {!desktopSidebarCollapsed ? <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${openSections[section.label] ? "rotate-90" : ""}`} /> : null}
                </button>
              )}
              {(openSections[section.label] || desktopSidebarCollapsed) && (
                <div className={`${desktopSidebarCollapsed ? "mt-2 space-y-2" : "ml-3 mt-1 space-y-1"}`}>
                  {section.items.map((item) => {
                    const isActive = currentPageName === item.page;
                    return (
                      <motion.div
                        key={item.page}
                        whileHover={{ x: 3 }}
                        transition={{ duration: 0.15 }}
                      >
                        {renderCollapsedTooltip(
                          item.label,
                          <Link
                            to={createPageUrl(item.page)}
                            className={`relative flex min-h-11 items-center rounded-xl text-sm transition-all duration-200 ${
                              desktopSidebarCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-3"
                            } ${isActive ? "font-semibold text-white" : "text-white/60 hover:text-white"}`}
                            style={isActive ? { background: "#39ACAC" } : { background: "transparent", border: "1px solid transparent" }}
                            onMouseEnter={(e) => {
                              if (!isActive) e.currentTarget.style.background = "#39ACAC";
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) e.currentTarget.style.background = "transparent";
                            }}
                            onClick={() => setSidebarOpen(false)}
                            title={desktopSidebarCollapsed ? item.label : undefined}
                          >
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            {!desktopSidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                          </Link>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
      </TooltipProvider>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden bg-slate-50">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={handleNavToggle}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label={isDesktop ? (desktopSidebarCollapsed ? "Expand navigation" : "Collapse navigation") : "Toggle navigation"}
            >
              {isDesktop ? (
                <ChevronLeft className={`h-5 w-5 transition-transform ${desktopSidebarCollapsed ? "rotate-180" : ""}`} />
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            <div className="flex items-center gap-2">
              <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="#1A334D" />
                <path d="M6 28 Q20 38 34 28" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <circle cx="20" cy="18" r="11" stroke="white" strokeWidth="1.8" fill="none" />
                <path d="M20 10 C24 14 24 22 20 26 C16 22 16 14 20 10Z" fill="white" />
              </svg>
              <div className="flex items-baseline gap-0">
                <span className="text-sm font-bold tracking-wide text-[#1A334D]">Reflectiv</span>
                <span className="text-sm font-bold tracking-wide text-[#39ACAC]">AI</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative" ref={notifMenuRef}>
              <button onClick={() => setNotificationsOpen((v) => !v)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" aria-label="Toggle notifications">
                <Bell className="h-4 w-4" />
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 z-[60] w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  <p className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">Notifications</p>
                  <Link to={createPageUrl("RolePlaySimulator")} className="block rounded-xl px-3 py-3 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700">Role Play feedback is ready to review.</Link>
                  <Link to={createPageUrl("PreCallPlanning")} className="block rounded-xl px-3 py-3 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700">Pre-Call Planning tips were updated.</Link>
                  <Link to={createPageUrl("HelpCenter")} className="block rounded-xl px-3 py-3 text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-700">Visit Help Center for platform guidance.</Link>
                </div>
              )}
            </div>
            <Link to={createPageUrl("ProfileSettings")} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" title="Profile Settings">
              <User className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <main className="flex-1 bg-slate-50">
          {children}
        </main>
      </div>

      <button
        data-chat-trigger="true"
        onClick={() => setAssistantOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[70] inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-teal-300 bg-[#1A334D] text-white shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl"
        aria-label="Open platform assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {assistantOpen && (
        <div ref={assistantRef} className="fixed bottom-24 right-4 z-[75] flex w-[min(340px,calc(100vw-2rem))] max-w-[90vw] flex-col overflow-hidden rounded-[28px] border border-teal-200 bg-white shadow-2xl md:right-5">
          <div className="flex items-start justify-between gap-3 bg-[#1A334D] px-4 py-4 text-white">
            <div>
              <p className="text-sm font-semibold">Platform Assistant</p>
              <p className="text-xs text-teal-100">Ask anything about using ReflectivAI.</p>
            </div>
            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[min(68vh,540px)] space-y-4 overflow-y-auto bg-white px-5 py-5">
            {assistantMessages.map((m, idx) => (
              <div key={idx} className={`flex items-start gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <img
                    src="/IMG_0817.jpeg"
                    alt="Alora avatar"
                    className="mt-1 h-10 w-10 rounded-full border border-slate-200 object-cover shadow-sm"
                  />
                )}
                <div className={`max-w-[82%] rounded-[18px] border px-4 py-3 text-[15px] shadow-sm ${m.role === "user" ? "border-[#1A3F63] bg-[#1A3F63] text-white" : "border-slate-100 bg-slate-50 text-slate-700"}`}>
                  <p className="whitespace-pre-wrap break-words leading-[1.55]">{m.content}</p>
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
            <div className="pointer-events-none absolute inset-y-0 right-6 flex items-center">
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
