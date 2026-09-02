# CONTEXT — Current Task

## Status: IN PROGRESS
**Current task:** Build `index.html` (single-file app) per PLAN.md chunk 1, then verify against `Historical_Data.csv`.

## Next steps (in order)
1. Write `index.html`: CSV upload + validation, PapaParse parsing of YYYYMMDD dates, Chart.js time-series with product/country filters and day/week/month aggregation, KPI cards (total, top/bottom products, by-country), trend + seasonality detection.
2. Add AI "Analyze" panel: configurable base URL / API key / model in UI (localStorage-persisted), temperature slider, system prompt; fallback statistical summary when unconfigured or on failure.
3. Verify: open/serve the file, load `Historical_Data.csv` (4849 rows) via a headless check of parse + aggregation logic; confirm no build step needed.
4. Git: init repo, commit all files except `.env`, create GitHub repo, push.

## Decisions already made (do NOT re-deliberate)
- Single `index.html` with CDN deps only (PapaParse + Chart.js). No npm/build.
- Weekly buckets start Monday; monthly = calendar months.
- Trend = linear regression slope on filtered series; seasonality = strongest month-of-year average vs overall mean.
- GitHub repo created via `gh` CLI (logged in as joenobk), private=false default, name `sales-analytics-tool`.

## Loop-trap guardrails (from .instructions.md)
No identical repeated tool calls without new info · ≤2 failures per path then switch strategy · verify progress every ≤5 tool calls · decide once and proceed.
