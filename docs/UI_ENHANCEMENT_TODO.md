# UI Enhancement TODO Tracker

This checklist captures the requested enterprise UI unification work and tracks implementation status.

## 1) Pre-Call Planning export workflow
- [x] Add embedded **Export Template PDF** pill at bottom of page.
- [x] Keep **Export Latest PDF** available and disabled when no plans exist.
- [x] Ensure export still works when plan fields are empty (template fallback filename/content).

## 2) Dashboard controls + naming
- [x] Remove top-level Notifications control that was not producing intuitive visible output.
- [x] Keep AI Insights refresh only within AI Insights panel (single source of refresh action).
- [x] Rename appearance preference language to **Color Mode** with Auto / Light / Dark options.

## 3) Knowledge Base clickable affordance consistency
- [x] Style **Summarize** action with the same pill affordance and hover behavior used by other clickable pills.
- [ ] Complete affordance unification audit across all remaining pages/components.

## 4) Performance Analytics + Manager View visual unification
- [x] Apply brand-forward shell/header cleanup to Performance Analytics.
- [x] Reduce KPI color sprawl in Manager View to brand-aligned palette (teal/navy/amber emphasis).
- [ ] Continue full enterprise-grade layout normalization across deeper Manager View sections.

## 5) Brand color integrity (teal / white / navy / pale yellow)
- [x] Begin palette normalization in touched pages.
- [ ] Complete full-app color and typography audit for remaining pages.

## 6) Cross-page UI unification follow-ups
- [ ] Standardize interactive control patterns (pill hover/focus/active/disabled) in shared design tokens.
- [ ] Standardize section-header typography scale and spacing system.
- [ ] Standardize badge colors/semantics for capability and status indicators.
- [ ] Run final visual QA sweep across Dashboard, Knowledge Base, Performance Analytics, Manager View, and RolePlay Simulator.
