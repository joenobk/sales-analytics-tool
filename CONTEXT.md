# CONTEXT — Current Task

## Status: COMPLETE — v2 shipped & verified in real Chrome over file://
**Repo:** https://github.com/joenobk/sales-analytics-tool (branch `main`)
**Run it:** open `index.html` directly in a browser, or `npx serve .`. No build step, no network needed. Header shows **"v2 (self-contained)"** — if your copy doesn't show that tag, you have the old file; re-download/hard-refresh.

## Next steps (in order, for future sessions)
1. User-side confirmation: open v2 in their browser and load `Historical_Data.csv` (should show "4,849 valid rows" + KPIs). Then exercise filters/aggregation/AI panel against at least 3 OpenAI-compatible providers (PRD success metric).
2. Optional polish from PRD §4: multi-select product filter already exists; consider date-range filter and CSV export of filtered view.
3. If requested: add a README.md pointing to the repo + run instructions.

## Decisions already made (do NOT re-deliberate)
- Single `index.html` with CDN deps only (PapaParse + Chart.js). No npm/build.
- Weekly buckets start Monday; monthly = calendar months.
- Trend = linear regression slope on filtered series; seasonality = strongest month-of-year average vs overall mean.
- GitHub repo created via `gh` CLI (logged in as joenobk), public, name `sales-analytics-tool`.

## Loop-trap guardrails (from .instructions.md)
No identical repeated tool calls without new info · ≤2 failures per path then switch strategy · verify progress every ≤5 tool calls · decide once and proceed.
