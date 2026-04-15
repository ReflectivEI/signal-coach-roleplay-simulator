import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, X } from "lucide-react";
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";
import { useState } from "react";

export default function CoachingNudgeBanner({ nudge }) {
  const [dismissed, setDismissed] = useState(false);

  if (!nudge || dismissed) return null;

  const capability = SIGNAL_INTELLIGENCE_CAPABILITIES.find(c => c.id === nudge.capabilityId);

  return (
    <AnimatePresence>
      <motion.div
        key={nudge.title}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border border-primary/30 bg-coaching-muted/40 p-3.5"
      >
        <div className="flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-primary">{nudge.title}</span>
              {capability && (
                <span className="text-xs text-primary/60 font-mono">
                  {capability.label}
                </span>
              )}
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">{nudge.guidance}</p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}