# Role Play Simulator Audit — 2026-04-02

## Scope
This audit covers:
1. Role Play Simulator architecture and data flow mapping.
2. Scenario grid filter mapping, including the six dropdowns above the grid.
3. Safety assessment for the next implementation step.
4. AI Coach Session Summary rendering regression observation.

## Protected contract surfaces (confirmed unchanged)
- `/api/llm/invoke` usage and request/response handling path remains unchanged.
- Session context handoff from Role Play to AI Coach (`session_context` query param) remains unchanged.
- Deterministic scoring and capability panel flow remains in Section 1 UI, with generated markdown in Sections 2–5.

## Simulator mapping (high-level)

### Entry and catalog
- `src/pages/RolePlaySimulator.jsx` is the simulator entry page.
- Scenarios are loaded from `src/lib/roleplay-v2/scenarioCatalog.js` (`ALL_SCENARIOS`).
- Taxonomy enrichment is applied via `enrichScenarioWithTaxonomy(...)` from `src/lib/roleplay-v2/scenarioTaxonomy.js`.

### Scenario card and run flow
- Scenario tiles are rendered with `EnterpriseScenarioCard`.
- Starting a scenario emits telemetry (`recordSimulatorTelemetry("scenario.start", ...)`) and routes into runtime interaction.

### Runtime and feedback
- Runtime conversation engine is in `src/components/roleplay/RolePlayChat.jsx`.
- Deterministic alignment and capability scoring are surfaced via `CapabilityFeedbackPanel` (Section 1 in End & Get Feedback).
- LLM-generated end-session narrative is parsed/normalized by `sessionFeedbackFormatter.js` and rendered as Sections 2–5.

## Six dropdowns above scenario grid
Current dropdowns in `RolePlaySimulator.jsx`:
1. Disease State
2. Specialty
3. HCP Category
4. Influence Driver
5. Journey Stage
6. Interaction Pressure

### Mapping source of truth
- 1–4 are direct scenario attributes from `scenarioCatalog.js`.
- 5–6 map to taxonomy dimensions from `scenarioTaxonomy.js` (`journeyStage`, `interactionPressure`).

### Are all six needed?
Recommendation:
- Keep all six for now (enterprise users need multidimensional slicing), but
- Treat **Disease State** and **Category pills** as partially overlapping controls.

Safe consolidation recommendation (future, optional):
- Consolidate Disease State + Category pills into one primary "Disease Area" control
  OR
- Keep both but make one read-only mirror to avoid user confusion.

Rationale:
- Today both dimensions often filter the same underlying field (`category`).
- This can feel redundant and creates UX ambiguity.

## Dropdown formatting audit
Issue observed:
- Journey Stage and Interaction Pressure displayed raw taxonomy tokens (e.g., `initial_access_prospecting`, `access_prior_auth_barrier`) which is not presentation-grade.

Decision:
- This is not intentional enterprise formatting; it should be humanized.

Safe fix implemented in this step:
- Added deterministic UI label formatter for taxonomy dropdown options.
- Kept underlying values unchanged to avoid contract/logic risk.

## AI Coach Session Summary regression observation
Observed risk:
- Session summary generation in `AICoach.jsx` was using brittle response extraction (`data.response || data.text || data.content`).
- If the response payload is non-string/object-shaped, summary rendering can silently fail or degrade.

Safe fix implemented in this step:
- Added shared normalization helper (`normalizeInvokeResponseText`) for robust extraction across string/array/object response shapes.
- Wired AICoach summary generation to use this normalization path.

## Next safe step recommendation after this audit
1. Keep current runtime contract surfaces unchanged.
2. Validate UX with PM/Design whether Disease State and Category should be merged.
3. Add one lightweight simulator UX telemetry event for dropdown usage (to measure real consolidation opportunity).
4. Keep AI Coach summary output robust with normalized invoke parsing and monitor summary null rate.

## Change classification
- Humanized dropdown option labels: **Safe frontend-only fix**.
- AI Coach summary response normalization: **Safe frontend-only robustness fix**.
- Dropdown consolidation: **Defer** until usage telemetry review.

