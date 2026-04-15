import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

export default function EnterpriseBanner({ title, subtitle, statLeft, statRight, ctaLabel, ctaTo }) {
  return (
    <div className="rounded-2xl overflow-hidden mb-8"
      style={{
        background: "linear-gradient(135deg, hsl(222, 52%, 17%) 0%, hsl(174, 28%, 16%) 60%, hsl(174, 35%, 19%) 100%)",
        border: "1px solid hsl(174 60% 52% / 0.3)"
      }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-7 py-6">
        {/* Left: label + title + subtitle */}
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "hsl(174 30% 18%)", border: "1px solid hsl(174 60% 52% / 0.4)" }}>
            <Zap className="w-5 h-5" style={{ color: "hsl(174 60% 65%)" }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "hsl(174 60% 65%)" }}>Signal Intelligence™ Practice</p>
            <h1 className="text-2xl font-bold text-foreground leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1.5 max-w-lg leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: stats + optional CTA */}
        <div className="flex items-center gap-3 shrink-0">
          {ctaLabel && ctaTo && (
            <Link
              to={ctaTo}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
            style={{ background: "hsl(174 45% 42%)", color: "hsl(210 40% 96%)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "hsl(174 45% 36%)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "hsl(174 45% 42%)"; }}
            >
              + {ctaLabel}
            </Link>
          )}
          {statLeft && (
            <div className="w-20 h-16 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{statLeft.value}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{statLeft.label}</span>
              {statLeft.sub && <span className="text-xs text-muted-foreground/60">{statLeft.sub}</span>}
            </div>
          )}
          {statRight && (
            <div className="w-20 h-16 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{statRight.value}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{statRight.label}</span>
              {statRight.sub && <span className="text-xs text-muted-foreground/60">{statRight.sub}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}