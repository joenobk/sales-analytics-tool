# CONTEXT — Current Task

## Status: IN PROGRESS — v7 rebuild underway; next chunk is **C0a** (see PLAN.md)
**Repo:** https://github.com/joenobk/sales-analytics-tool (branch `main`)
**Run it:** open `index.html` directly in a browser, or `npx serve .`. No build step, no network needed. Header shows **"v6 (self-contained)"** with an orange star icon — if your copy doesn't show that tag/icon, you have the old file; re-download/hard-refresh.

## v3 features (session 4)
Freeform AI question input · multi-select country filter · regression + moving-average trendline overlays on chart · select-all/deselect-all product buttons · orange five-point star favicon + in-app icon. All verified by extended real-Chrome e2e test.

## v4 features (session 5)
AI answer history (scrollable, newest on top; data stays visible while scrolling) · markdown rendering of AI answers incl. tables with horizontal scroll (inlined `marked` 12.0.2) · conversation caching: follow-up questions reuse the cached data context — no re-Analyze needed until filters change ("New analysis" button forces a fresh conversation).

## v5 features (session 6)
Full-data visibility for the AI: first request now includes the COMPLETE filtered dataset at month x product x country grain (~406 nonzero cells ≈ ~2,900 tokens for Historical_Data.csv), so the model can answer per-product/per-country monthly questions directly. Default system prompt updated to match. Follow-ups still reuse cached context (no re-send).

## v6 features (session 7)
In-flight progress indicator: while an analysis is running, a status entry at the top of the AI history shows an animated spinner + phase label ("Preparing…" → "Analyzing… (N KB sent to model)" → "Receiving response…") + a live elapsed timer ticking every 500ms. The Analyze button is disabled and relabeled "Analyzing…" while in-flight; on failure the elapsed time is included in the error line. A muted note explains that local models take 15s+ to warm up so long waits are expected (a non-streaming call returns no intermediate status, so timer + payload size is the truthful signal).

## Next step (for the next session)
**Start chunk C0a in PLAN.md** (Phase 0 — Refactor & harden): split SalesCore into named modules on a `core` namespace and introduce the light state container so filters/datasets/chart specs/AI context live in one observable object instead of being read from the DOM. Behavior must stay identical; v6 numbers unchanged; both verify harnesses pass. Follow the handoff protocol at the top of PLAN.md (one chunk per session, update core files, commit + push).

## Decisions already made (do NOT re-deliberate)
- Single self-contained `index.html`; PapaParse, Chart.js and marked are inlined (no CDN, no npm/build).
- Weekly buckets start Monday; monthly = calendar months.
- Trend = linear regression slope on filtered series; seasonality = strongest month-of-year average vs overall mean.
- GitHub repo created via `gh` CLI (logged in as joenobk), public, name `sales-analytics-tool`.

## Loop-trap guardrails (from .instructions.md)
No identical repeated tool calls without new info · ≤2 failures per path then switch strategy · verify progress every ≤5 tool calls · decide once and proceed.
