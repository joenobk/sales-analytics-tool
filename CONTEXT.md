# CONTEXT — Current Task

## Status: COMPLETE (product delivered & pushed)
**Repo:** https://github.com/joenobk/sales-analytics-tool (branch `main`)
**Run it:** open `index.html` directly in a browser, or `npx serve .` and visit the URL. No build step.

## Next steps (in order, for future sessions)
1. Browser smoke test: load `Historical_Data.csv` via the UI, exercise filters/aggregation/AI panel against at least 3 OpenAI-compatible providers (PRD success metric).
2. Optional polish from PRD §4: multi-select product filter already exists; consider date-range filter and CSV export of filtered view.
3. If requested: add a README.md pointing to the repo + run instructions.

## Decisions already made (do NOT re-deliberate)
- Single `index.html` with CDN deps only (PapaParse + Chart.js). No npm/build.
- Weekly buckets start Monday; monthly = calendar months.
- Trend = linear regression slope on filtered series; seasonality = strongest month-of-year average vs overall mean.
- GitHub repo created via `gh` CLI (logged in as joenobk), public, name `sales-analytics-tool`.

## Loop-trap guardrails (from .instructions.md)
No identical repeated tool calls without new info · ≤2 failures per path then switch strategy · verify progress every ≤5 tool calls · decide once and proceed.
