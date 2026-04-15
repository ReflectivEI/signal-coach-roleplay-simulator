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
    <div className="shrink-0 border-b border-border/60 bg-surface/60 px-4 py-3 space-y-2.5">
      {/* Scene environment */}
      <div className="flex items-start gap-2.5">
        <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider mr-2">Scene</span>
          <span className="text-xs text-foreground/70 leading-relaxed">{sceneDescription}</span>
        </div>
      </div>

      {/* Rep guidance chips — only for rep_initiated, hidden after first rep turn */}
      {isRepInitiated && conversationInit.openingGuidance?.length > 0 && (
        <div className="flex items-start gap-2.5">
          <Lightbulb className="w-3.5 h-3.5 text-signal-watch shrink-0 mt-0.5" />
          <div className="flex flex-wrap gap-1.5">
            {conversationInit.openingGuidance.map((hint, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-md bg-signal-watch/10 border border-signal-watch/20 text-signal-watch"
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