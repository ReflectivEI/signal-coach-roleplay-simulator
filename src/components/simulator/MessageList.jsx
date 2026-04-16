import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Stethoscope, Loader2, Lightbulb } from "lucide-react";
// User is used both for rep bubbles and the empty-state placeholder
import { SIGNAL_INTELLIGENCE_CAPABILITIES } from "@/lib/signalIntelligence";

// HCP cues are single-line observable behavioral signals aligned with dialogue
function HcpCueStrip({ cue }) {
  if (!cue) return null;
  return (
    <div
      className="inline-flex items-center max-w-fit px-3 py-1 rounded-full border text-[11px] italic leading-snug"
      style={{
        background: "rgba(244, 232, 236, 0.92)",
        borderColor: "rgba(191, 132, 145, 0.46)",
        color: "hsl(356 32% 43%)",
      }}
    >
      {cue.label}
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
      className="inline-flex items-center max-w-fit px-3 py-1 rounded-full border text-[11px] leading-snug"
      style={{
        background: "rgba(255, 248, 223, 0.96)",
        borderColor: "rgba(215, 186, 98, 0.48)",
        color: "hsl(40 46% 38%)",
      }}
    >
      {nudge.guidance}
    </motion.div>
  );
}

function MessageBubble({ turn }) {
  const isRep = turn.speaker === "rep";
  const isHcp = turn.speaker === "hcp";
  const cue = turn.cues?.[0] || null;
  const nudge = turn.nudge || null;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex gap-3 mb-3"
      >
        <div className={`${isRep ? "order-2" : "order-1"} mt-1 shrink-0`}>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: isRep ? "rgba(29, 134, 126, 0.16)" : "rgba(213, 220, 233, 0.76)",
              color: isRep ? "hsl(177 49% 36%)" : "hsl(222 30% 35%)",
              border: isRep ? "1px solid rgba(46, 124, 121, 0.24)" : "1px solid rgba(131, 164, 186, 0.24)",
            }}
          >
            {isRep ? "REP" : "HCP"}
          </span>
        </div>
        <div className={`${isRep ? "order-1 items-end ml-auto" : "order-2 items-start"} flex flex-col gap-1 max-w-[82%]`}>
          {isHcp && cue && <HcpCueStrip cue={cue} />}
          <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-fit" style={{
            background: isRep ? "linear-gradient(180deg, rgba(90, 182, 186, 0.92) 0%, rgba(74, 163, 170, 0.94) 100%)" : "linear-gradient(180deg, rgba(237,241,247,0.98) 0%, rgba(229,235,244,0.98) 100%)",
            color: isRep ? "white" : "hsl(222 30% 28%)",
            border: isRep ? "1px solid rgba(74, 163, 170, 0.34)" : "1px solid rgba(193, 203, 219, 0.72)",
            boxShadow: isRep ? "0 10px 24px rgba(16, 54, 76, 0.06)" : "0 6px 18px rgba(14, 24, 43, 0.04)"
          }}>
            {turn.text}
          </div>
          {isRep && nudge && <RepCoachingTip nudge={nudge} />}
        </div>
      </motion.div>
    </div>
  );
}

export default function MessageList({ turns, isLoading, realtimeFeedback }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, isLoading]);

  return (
    <div className="px-6 py-6 flex-1 overflow-y-auto space-y-3">
      {turns.length === 0 && !isLoading && (
        <div className="py-12 text-center flex flex-col items-center justify-center h-full gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(145deg, hsl(223 46% 19%), hsl(176 45% 30%))", border: "1px solid rgba(46, 124, 121, 0.24)" }}>
            <User className="w-4 h-4" style={{ color: "white" }} />
          </div>
          <p className="text-sm leading-relaxed max-w-xs" style={{ color: "hsl(215 18% 46%)" }}>
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
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: "linear-gradient(145deg, hsl(223 46% 19%), hsl(214 53% 28%))" }}>
            <Stethoscope className="w-3 h-3" style={{ color: "white" }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium" style={{ color: "hsl(177 49% 36%)" }}>HCP</span>
            <div className="px-4 py-2.5 rounded-2xl" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)", border: "1px solid rgba(131, 164, 186, 0.24)" }}>
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: "hsl(215 18% 46%)" }} />
                <span className="text-xs" style={{ color: "hsl(215 18% 46%)" }}>Thinking...</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
