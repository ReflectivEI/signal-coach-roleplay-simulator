import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Stethoscope, Loader2, Lightbulb } from "lucide-react";
// User is used both for rep bubbles and the empty-state placeholder
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";

// HCP cues are single-line observable behavioral signals aligned with dialogue
function HcpCueStrip({ cue }) {
  if (!cue) return null;
  return (
    <div className="mb-2 ml-10">
      <p className="text-primary/60 text-xs leading-relaxed italic">
        ◆ {cue}
      </p>
    </div>
  );
}

// Coaching tip section with capability header
function RepCoachingTip({ nudge }) {
  if (!nudge) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.08 }}
      className="mt-2 mb-4 ml-10 pl-3 border-l-2 border-primary/30"
    >
      <p className="text-primary/70 text-xs font-medium uppercase tracking-wide mb-1">
        {nudge.capabilityName || nudge.title}
      </p>
      <p className="text-primary/60 text-xs leading-relaxed">
        {nudge.guidance}
      </p>
    </motion.div>
  );
}

function MessageBubble({ turn }) {
  const isRep = turn.speaker === "rep";
  const isHcp = turn.speaker === "hcp";
  const cue = turn.cues?.[0] ? turn.cues[0].label : null;
  const nudge = turn.nudge || null;

  return (
    <div>
      {isHcp && <HcpCueStrip cue={cue} />}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex gap-3 mb-3"
      >
        <div className={`${isRep ? "order-2" : "order-1"} w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1`} style={{
          background: isRep ? "hsl(222 30% 20%)" : "hsl(222 30% 20%)"
        }}>
          {isRep ? (
            <User className="w-3 h-3" style={{ color: "hsl(174 60% 52%)" }} />
          ) : (
            <Stethoscope className="w-3 h-3" style={{ color: "hsl(174 60% 52%)" }} />
          )}
        </div>
        <div className={`${isRep ? "order-1 items-end" : "order-2 items-start"} flex flex-col gap-0.5 max-w-[70%]`}>
          <span className="text-xs font-medium" style={{ color: "hsl(174 60% 52%)" }}>
            {isRep ? "You (Rep)" : "HCP"}
          </span>
          <div className="px-4 py-2.5 rounded-lg text-sm leading-relaxed" style={{
            background: isRep ? "hsl(222 30% 16%)" : "hsl(222 40% 18%)",
            color: "hsl(210 40% 95%)",
            border: `1px solid hsl(${isRep ? "222 30% 26%" : "174 40% 28%"})`
          }}>
            {turn.text}
          </div>
          <span className="text-xs mt-0.5" style={{ color: "hsl(215 20% 45%)" }}>
            {new Date(turn.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </motion.div>
      {isRep && <RepCoachingTip nudge={nudge} />}
    </div>
  );
}

export default function MessageList({ turns, isLoading, realtimeFeedback }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, isLoading]);

  return (
    <div className="px-5 py-5 flex-1 overflow-y-auto space-y-3" style={{ background: "hsl(222 40% 8%)" }}>
      {turns.length === 0 && !isLoading && (
        <div className="py-12 text-center flex flex-col items-center justify-center h-full gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "hsl(222 30% 16%)", border: "1px solid hsl(222 30% 24%)" }}>
            <User className="w-4 h-4" style={{ color: "hsl(215 20% 45%)" }} />
          </div>
          <p className="text-sm leading-relaxed max-w-xs" style={{ color: "hsl(215 20% 45%)" }}>
            The HCP is in the room. You go first.
          </p>
        </div>
      )}
      <AnimatePresence>
        {turns.map((turn) => (
          <div key={turn.id}>
            <MessageBubble turn={turn} />
          </div>
        ))}
      </AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-3 items-start mt-4"
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: "hsl(222 30% 20%)" }}>
            <Stethoscope className="w-3 h-3" style={{ color: "hsl(174 60% 52%)" }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium" style={{ color: "hsl(174 60% 52%)" }}>HCP</span>
            <div className="px-4 py-2.5 rounded-lg" style={{ background: "hsl(222 40% 18%)", border: "1px solid hsl(174 40% 28%)" }}>
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: "hsl(215 20% 45%)" }} />
                <span className="text-xs" style={{ color: "hsl(215 20% 45%)" }}>Thinking...</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}