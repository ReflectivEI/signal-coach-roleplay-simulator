import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TERM_DEFINITIONS = {
  "Discovery": "Early-stage conversation where the rep learns about the HCP's patient population, clinical priorities, and current workflows.",
  "Open": "HCP is receptive and engaged; showing genuine interest in the conversation and willing to explore the topic.",
  "Treating Clinician": "Physician directly responsible for patient care and clinical decision-making in their practice.",
  "Patient-Centric": "HCP prioritizes patient outcomes and benefits as the primary decision driver.",
};

export default function TermTooltip({ term, children }) {
  const definition = TERM_DEFINITIONS[term];
  
  if (!definition) {
    return children;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-slate-300 border-dotted hover:border-slate-500 transition-colors">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm bg-white text-slate-900 border border-slate-200 text-sm font-normal rounded-lg p-3 shadow-lg">
          {definition}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}