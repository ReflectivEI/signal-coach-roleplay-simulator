# RPS UX Guardrails

## Canonical Control Contract

The only user-facing RPS configuration model is:

1. HCP Profile
2. Scenario Stage
3. Challenge Context
4. Realism slider

This must always be described as:

"3 selectors + 1 realism slider"

Do NOT describe this as:
- 3 controls
- 4 dropdowns
- 6 filters
- full predictive controls

## Forbidden User-Facing Controls

The following must never appear as selectable UI controls:

- Disease State
- Specialty
- Interaction Pressure
- Influence Driver
- Behavior Archetype
- Decision Orientation
- Persona
- Starting Behavior State
- REP Objective
- Predictive Seed controls

These are derived internally only.

## Allowed Advanced/Debug Behavior

Advanced/debug sections may show derived values only if:
- read-only
- collapsed by default
- clearly labeled as derived/debug
- not selectable
- not required for normal users

## Single Source of Truth

All public option labels must come from:

`src/lib/rpsUserInputOptions.ts`

No page/component may define its own parallel public option set.

## Mapping Rule

All hidden/internal fields must be derived through:

`src/lib/scenarioInputResolver.ts`

UI components must not manually construct internal predictive brain fields.

## Regression Rule

Fail any PR/change if:
- more than 3 selector dropdowns are visible on any RPS surface
- realism slider is missing
- old labels return
- advanced/debug controls become selectable
- mobile/tablet nav hides or clips page links