import { MapPin, Lightbulb } from "lucide-react";

// IMPORTANT: The "Opening Scene" is the situational/environmental context that sets the tone
// for the interaction — NOT HCP dialogue. HCP dialogue appears only in the chat thread.
// For rep_initiated: show scene + rep guidance chips
// For hcp_initiated: show scene only (HCP's opening line already appears as the first chat message)

export default function OpeningSceneBanner({ scenario, conversationInit }) {
  if (!scenario || !conversationInit) return null;

  const isRepInitiated = conversationInit.startType === "rep_initiated";

  // Use the generated visual scene ONLY — never fall back to context (HCP profile)
  const sceneDescription = scenario.visualScene || scenario.description || "";

  return (
    <div
      className="shrink-0 px-5 py-4 space-y-3"
      style={{
        background: "linear-gradient(92deg, hsl(224 50% 15%) 0%, hsl(214 54% 21%) 42%, hsl(186 44% 20%) 100%)",
      }}
    >
      {/* Scene environment */}
      <div className="flex items-start gap-2.5">
        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "hsl(174 60% 70%)" }} />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wider mr-2" style={{ color: "hsl(174 60% 70%)" }}>Scene</span>
          <span className="text-xs leading-relaxed" style={{ color: "rgba(239, 247, 247, 0.86)" }}>{sceneDescription}</span>
        </div>
      </div>

      {/* Rep guidance chips — only for rep_initiated, hidden after first rep turn */}
      {isRepInitiated && conversationInit.openingGuidance?.length > 0 && (
        <div className="flex items-start gap-2.5">
          <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "hsl(36 90% 72%)" }} />
          <div className="flex flex-wrap gap-1.5">
            {conversationInit.openingGuidance.map((hint, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-md"
                style={{
                  background: "rgba(255, 208, 118, 0.10)",
                  border: "1px solid rgba(255, 208, 118, 0.28)",
                  color: "hsl(36 90% 78%)",
                }}
              >
                {hint}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
