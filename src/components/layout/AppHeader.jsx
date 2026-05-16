import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { BookOpen, Brain, FlaskConical, GitBranch, Menu, Settings, X, Zap } from "lucide-react";

const MAIN_SITE_URL = "https://reflectiv-ai.com";

const BASE_NAV_ITEMS = [
  { to: "/library", label: "Library", Icon: BookOpen },
  { to: "/predictive-builder", label: "Predictive Builder", Icon: Brain },
  { to: "/rps-adaptive", label: "Adaptive RPS", Icon: GitBranch },
  { to: "/capabilities", label: "Capabilities", Icon: Brain },
  { to: "/qa", label: "QA Twin", Icon: FlaskConical },
  { to: "/admin", label: "Admin", Icon: Settings },
];

function DesktopNavLink({ item }) {
  const { Icon } = item;
  if (item.external) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        className="whitespace-nowrap text-sm font-medium text-[#17213f] transition-all duration-200 flex items-center gap-1.5 hover:-translate-y-0.5 hover:text-teal-700"
      >
        <Icon className="w-3.5 h-3.5" />
        {item.label}
      </a>
    );
  }
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => [
        "whitespace-nowrap text-sm font-medium transition-all duration-200 flex items-center gap-1.5 hover:-translate-y-0.5 hover:text-teal-700",
        isActive ? "text-teal-700" : "text-[#17213f]",
      ].join(" ")}
    >
      <Icon className="w-3.5 h-3.5" />
      {item.label}
    </NavLink>
  );
}

function MobileNavLink({ item, onClick }) {
  const { Icon } = item;
  if (item.external) {
    return (
      <a
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors bg-white/55 hover:bg-white/80"
        style={{
          color: "hsl(222 40% 26%)",
          border: "1px solid rgba(92, 135, 165, 0.22)",
          boxShadow: "none",
        }}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {item.label}
      </a>
    );
  }
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) => [
        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
        isActive ? "bg-white/90" : "bg-white/55 hover:bg-white/80",
      ].join(" ")}
      style={({ isActive }) => ({
        color: isActive ? "hsl(177 49% 34%)" : "hsl(222 40% 26%)",
        border: "1px solid rgba(92, 135, 165, 0.22)",
        boxShadow: isActive ? "0 10px 24px rgba(14, 24, 43, 0.08)" : "none",
      })}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {item.label}
    </NavLink>
  );
}

export default function AppHeader({ maxWidthClassName = "max-w-[1420px]" }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const isLocalHost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const navItems = [
    BASE_NAV_ITEMS[0],
    isLocalHost
      ? { to: "/simulator", label: "Role Play Simulator", Icon: Zap }
      : { to: "https://rps.reflectiv-ai.com", label: "Role Play Simulator", Icon: Zap, external: true },
    ...BASE_NAV_ITEMS.slice(1),
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  return (
    <div
      className="sticky top-0 z-20 backdrop-blur-xl"
      style={{
        background: "rgba(255,255,255,0.84)",
        borderBottom: "1px solid rgba(38, 67, 117, 0.18)",
        boxShadow: "0 10px 24px rgba(14, 24, 43, 0.06)",
      }}
    >
      <div className={`${maxWidthClassName} mx-auto px-5 xl:px-6 py-3.5`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Signal Intelligence home">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(145deg, hsl(223 56% 18%), hsl(182 48% 23%))",
                  boxShadow: "0 8px 18px rgba(12, 25, 46, 0.14)",
                }}
              >
                <Zap className="w-4 h-4" style={{ color: "hsl(174 60% 70%)" }} />
              </div>
              <span className="font-semibold text-[1.02rem] leading-tight" style={{ color: "hsl(222 48% 22%)" }}>
                Signal Intelligence
              </span>
            </Link>
            <a
              href={MAIN_SITE_URL}
              aria-label="Back to Reflectiv AI main site"
              title="Back to main site"
              className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:text-teal-700"
              style={{
                background: "rgba(255,255,255,0.76)",
                borderColor: "hsl(222 52% 24% / 0.55)",
                color: "hsl(222 52% 24%)",
                boxShadow: "0 8px 18px rgba(12, 25, 46, 0.08)",
              }}
            >
              Home
            </a>
          </div>

          <nav className="hidden xl:flex items-center gap-3" aria-label="Primary">
            {navItems.map((item) => <DesktopNavLink key={item.to} item={item} />)}
          </nav>

          <button
            type="button"
            className="xl:hidden inline-flex items-center justify-center rounded-xl p-2.5 transition-colors"
            style={{
              color: "hsl(222 52% 24%)",
              background: menuOpen ? "rgba(20, 66, 112, 0.08)" : "transparent",
              border: "1px solid rgba(38, 67, 117, 0.16)",
            }}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <nav id={menuId} className="xl:hidden pt-3" aria-label="Mobile primary">
            <div
              className="grid gap-2 rounded-[24px] p-3"
              style={{
                background: "linear-gradient(180deg, rgba(244,249,249,0.96) 0%, rgba(234,243,245,0.96) 100%)",
                border: "1px solid rgba(92, 135, 165, 0.22)",
                boxShadow: "0 16px 32px rgba(14, 24, 43, 0.08)",
              }}
            >
              {navItems.map((item) => (
                <MobileNavLink key={item.to} item={item} onClick={() => setMenuOpen(false)} />
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
