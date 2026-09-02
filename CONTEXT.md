# CONTEXT — Current Task

## Status: COMPLETE — v4 shipped & verified in real Chrome over file://
**Repo:** https://github.com/joenobk/sales-analytics-tool (branch `main`)
**Run it:** open `index.html` directly in a browser, or `npx serve .`. No build step, no network needed. Header shows **"v4 (self-contained)"** with an orange star icon — if your copy doesn't show that tag/icon, you have the old file; re-download/hard-refresh.

## v3 features (session 4)
Freeform AI question input · multi-select country filter · regression + moving-average trendline overlays on chart · select-all/deselect-all product buttons · orange five-point star favicon + in-app icon. All verified by extended real-Chrome e2e test.

## v4 features (session 5)
AI answer history (scrollable, newest on top; data stays visible while scrolling) · markdown rendering of AI answers incl. tables with horizontal scroll (inlined `marked` 12.0.2) · conversation caching: follow-up questions reuse the cached data context — no re-Analyze needed until filters change ("New analysis" button forces a fresh conversation).

## Next steps (in order, for future sessions)
1. User-side confirmation: open v4 in their browser and load `Historical_Data.csv` (should show "4,849 valid rows" + KPIs). Then exercise filters/aggregation/AI panel against at least 3 OpenAI-compatible providers (PRD success metric), including follow-up questions to confirm context caching.
2. Optional polish from PRD §4: consider date-range filter and CSV export of filtered view.
3. If requested: add a README.md pointing to the repo + run instructions.

## Decisions already made (do NOT re-deliberate)
- Single self-contained `index.html`; PapaParse, Chart.js and marked are inlined (no CDN, no npm/build).
- Weekly buckets start Monday; monthly = calendar months.
- Trend = linear regression slope on filtered series; seasonality = strongest month-of-year average vs overall mean.
- GitHub repo created via `gh` CLI (logged in as joenobk), public, name `sales-analytics-tool`.

## Loop-trap guardrails (from .instructions.md)
No identical repeated tool calls without new info · ≤2 failures per path then switch strategy · verify progress every ≤5 tool calls · decide once and proceed.
