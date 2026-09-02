# PRD: Sales Data Analytics Tool (single-file web app)

## Goal
A lightweight, privacy-focused single-page app: user uploads a sales CSV in the browser and gets instant visual analytics plus optional AI-driven insights from any OpenAI-compatible API. No backend, no build step — one `index.html` opened directly.

## Success Metrics
- Opens interactively in <2s; first-time user sees a chart within 30s of upload.
- Works with `Historical_Data.csv` (4849 rows: Date YYYYMMDD int, Article_ID, Country_Code ∈ {AT,FI,FR,SE}, Sold_Units).
- AI insights work against any OpenAI-compatible endpoint; graceful statistical fallback when unconfigured/failing.

## Functional Requirements
1. **Ingestion**: file picker + drag-drop for `.csv`; validate required columns (`Date`, `Article_ID`, `Country_Code`, `Sold_Units`) with clear errors; parse YYYYMMDD integers to real dates; all parsing client-side (PapaParse).
2. **Visualization**: time-series chart of units sold over time; filters for product(s) and country; aggregation toggle day/week/month.
3. **KPIs / insights**: total units, top & bottom products, sales by country breakdown, visible trend direction + seasonality signal (e.g., month-of-year pattern).
4. **AI panel ("Analyze")**: sends a compact summary of the *filtered* data (not raw CSV) to a configurable OpenAI-compatible chat completions API — base URL, API key, model name in UI; temperature slider; system prompt editable; config persisted in localStorage. Fallback: statistical summary (mean/median/growth rate) when no API configured or request fails.
5. **UX**: top bar (upload + settings), left sidebar filters, center chart + KPI cards, bottom/right AI panel with copy-to-clipboard.

## Technical Constraints
- Single HTML file; CDN deps only: PapaParse, Chart.js. No build step.
- Security: no data leaves the browser except to the user-configured API endpoint; keys stored in localStorage only.

## Assumptions (stated)
- One row = one day of sales for a product/country combo; missing days are zero-sales gaps, not errors.
- Weekly buckets start Monday; monthly buckets use calendar months.
- "Trend" = linear regression slope over the filtered series; seasonality = strongest month-of-year average vs overall mean.
