import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Stethoscope, Loader2 } from "lucide-react";
// User is used both for rep bubbles and the empty-state placeholder

const SHOW_DEBUG_UI = Boolean(import.meta.env.DEV);
const SHOW_VISIBLE_HCP_CUES = false;

function formatCueValue(value, fallback = "Not yet established") {
  const text = String(value || "").replace(/_/g, " ").trim();
  if (!text) return fallback;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildBehavioralNotes(cue) {
  const rawLabel = typeof cue?.label === "string" ? cue.label.trim() : "";
  if (!rawLabel) return "Listening for the rep's opening move.";
  const normalizedLabel = rawLabel
    .replace(/^[a-z]/, (letter) => letter.toUpperCase())
    .replace(/[.?!]$/, "");
  return normalizedLabel.toLowerCase().startsWith("the hcp")
    ? `${normalizedLabel}.`
    : `The HCP ${normalizedLabel.charAt(0).toLowerCase()}${normalizedLabel.slice(1)}.`;
}

function HcpCueSummary({ cue, prediction }) {
  if (!cue && !prediction) return null;
  const predictedState = prediction?.predictedBehaviorState || prediction?.nextLikelyBehavior || prediction?.concernFamily;
  const openness = prediction?.openness || prediction?.opennessLevel;
  const trajectory = prediction?.trajectory || prediction?.nextLikelyBehavior;
  const risk = prediction?.riskLevel || prediction?.concernFamily;

  return (
    <div className="pl-1 w-fit max-w-[92%] md:max-w-[82%]">
      <div
        className="w-fit max-w-full text-xs leading-snug px-3 py-2 rounded-lg border whitespace-normal break-words"
        style={{
          color: "#7B1F1F",
          borderColor: "#D7B7B7",
          background: "#F9F5F5",
        }}
      >
        <div className="font-semibold tracking-wide uppercase text-[10px] mb-1">HCP Cues</div>
        <div className="hcp-cue-predicted-state">- Predicted State: {formatCueValue(predictedState, "Guarded")}</div>
        <div className="hcp-cue-openness">- Openness: {formatCueValue(openness, "Guarded")}</div>
        <div className="hcp-cue-trajectory">- Trajectory: {formatCueValue(trajectory, "Testing relevance")}</div>
        <div className="hcp-cue-risk">- Risk: {formatCueValue(risk, "Moderate")}</div>
        <div className="hcp-cue-behavioral-notes">- Behavioral Notes: {buildBehavioralNotes(cue)}</div>
      </div>
    </div>
  );
}

// HCP cues are single-line observable behavioral signals aligned with dialogue
function HcpCueStrip({ cue }) {
  if (!cue) return null;
  const rawLabel = typeof cue.label === "string" ? cue.label.trim() : "";
  const normalizedLabel = rawLabel
    ? rawLabel.replace(/^[a-z]/, (letter) => letter.toUpperCase()).replace(/[.?!]$/, "")
    : "";
  const cueText = normalizedLabel.toLowerCase().startsWith("the hcp")
    ? `${normalizedLabel}.`
    : `The HCP ${normalizedLabel.charAt(0).toLowerCase()}${normalizedLabel.slice(1)}.`;
  return (
    <div
      className="inline-flex items-center max-w-fit px-3 py-1 rounded-full border text-[11px] italic leading-snug"
      style={{
        background: "rgba(244, 232, 236, 0.92)",
        borderColor: "rgba(191, 132, 145, 0.46)",
        color: "hsl(356 32% 43%)",
      }}
    >
      {cueText}
    </div>
  );
}

function PredictiveDebugChip({ debugInfo }) {
  const [open, setOpen] = useState(false);
  if (!SHOW_DEBUG_UI || !debugInfo) return null;

  const applied = Boolean(debugInfo.contextApplied);
  const sourceLabel = debugInfo.source === "ai" ? "AI" : debugInfo.source === "deterministic" ? "Deterministic" : "";
  const surfacedSignals = Array.isArray(debugInfo.surfacedSignals) ? debugInfo.surfacedSignals : [];

  return (
    <div className="max-w-fit rounded-xl border px-3 py-2" style={{
      background: applied ? "rgba(225, 245, 240, 0.84)" : "rgba(238, 241, 246, 0.92)",
      borderColor: applied ? "rgba(70, 153, 138, 0.42)" : "rgba(132, 149, 173, 0.42)",
    }}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: applied ? "hsl(171 48% 30%)" : "hsl(220 22% 38%)" }}>
          {applied ? "Predictive Applied" : "Predictive Debug"}
        </span>
        {sourceLabel ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{
            color: applied ? "hsl(171 48% 30%)" : "hsl(220 22% 38%)",
            borderColor: applied ? "rgba(70, 153, 138, 0.42)" : "rgba(132, 149, 173, 0.42)",
            background: "rgba(255,255,255,0.62)",
          }}>
            {sourceLabel}
          </span>
        ) : null}
        <button
          type="button"
          className="text-[10px] underline"
          style={{ color: applied ? "hsl(171 48% 30%)" : "hsl(220 22% 38%)" }}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Hide" : "View"}
        </button>
      </div>

      {open && (
        <div className="mt-2.5 space-y-2">
          {surfacedSignals.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {surfacedSignals.map((signal) => (
                <span key={signal} className="text-[10px] px-2 py-0.5 rounded-md" style={{
                  color: applied ? "hsl(171 48% 28%)" : "hsl(220 20% 36%)",
                  background: "rgba(255,255,255,0.72)",
                  border: applied ? "1px solid rgba(70, 153, 138, 0.34)" : "1px solid rgba(132, 149, 173, 0.34)",
                }}>
                  {signal}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px]" style={{ color: "hsl(171 35% 34%)" }}>
              Predictive context was injected, but this turn did not expose a distinct surfaced blocker tag.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ turn }) {
  const isRep = turn.speaker === "rep";
  const isHcp = turn.speaker === "hcp";
  const cue = turn.cues?.[0] || null;
  const prediction = turn.prediction || null;
  const predictiveDebug = turn.predictiveDebug || null;

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
          {isHcp && SHOW_VISIBLE_HCP_CUES && <HcpCueSummary cue={cue} prediction={prediction} />}
          {isHcp && cue && SHOW_DEBUG_UI && SHOW_VISIBLE_HCP_CUES && <HcpCueStrip cue={cue} />}
          {isHcp && predictiveDebug && <PredictiveDebugChip debugInfo={predictiveDebug} />}
          <div className={`${isHcp ? "hcp-dialogue " : ""}px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed max-w-fit`} style={{
            background: isRep ? "linear-gradient(180deg, rgba(90, 182, 186, 0.92) 0%, rgba(74, 163, 170, 0.94) 100%)" : "linear-gradient(180deg, rgba(237,241,247,0.98) 0%, rgba(229,235,244,0.98) 100%)",
            color: isRep ? "white" : "hsl(222 30% 28%)",
            border: isRep ? "1px solid rgba(74, 163, 170, 0.34)" : "1px solid rgba(193, 203, 219, 0.72)",
            boxShadow: isRep ? "0 10px 24px rgba(16, 54, 76, 0.06)" : "0 6px 18px rgba(14, 24, 43, 0.04)"
          }}>
            {turn.text}
          </div>
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
    <div className="px-6 py-6 pb-28 flex-1 overflow-y-auto space-y-3">
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
