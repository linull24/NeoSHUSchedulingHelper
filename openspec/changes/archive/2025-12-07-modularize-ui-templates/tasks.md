## Tasks
- [x] Align specs (ui-templates, ui-filters, ui-pagination) with meta-template, token pack, hover/filter/footer requirements; validate change.
- [x] Define SCSS/CSS token map (Material-aligned): spacing, radius, font scale, color roles (surface/border/accent/warn/muted), elevation, chip states; document density modes and min-layout guardrails in design.md.
- [x] Author base list meta-template spec details: slot contract (header/search/filter/body/footer), responsive clamp rules, stacked fallback thresholds, density mode behavior.
- [x] Add hover/diagnostics/filter template spec details: panel padding/elevation/radius from tokens, chip row layout, settings/preset slot; restate hover-disable rules.
- [x] Add pagination/footer spec details: prev/next + neighbor/jump controls; page-size display (settings-driven), total count summary; hide cleanly in continuous mode.
- [x] Implementation rollout plan (mapping only): enumerate target components (ConstraintList, DiagnosticsList, HoverInfoBar, course/solver filter bars) and SCSS refactors (replace fixed sizes with tokens, align typography to Material scale, shared chip styles).
