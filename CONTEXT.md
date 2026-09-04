# CONTEXT — Current Task

## Status: V7 Phase 0 (refactor & harden) shipped as v6.02, verified in real Chrome over file://; Phase 1 is next
**Repo:** https://github.com/joenobk/sales-analytics-tool (branch `main`)
**Run it:** open `index.html` directly in a browser, or `npx serve .`. No build step, no network needed. Header shows **"v6.02 (self-contained)"** with an orange star icon — if your copy doesn't show that tag/icon, you have the old file; re-download/hard-refresh.

## Versioning policy (user decision 2026-09-04)
While v7 work is in progress, the header tag uses **v6.XX** increments of .01 per shipped change (currently v6.02). Only when ALL v7 phases are complete does the tag become **"v7 (self-contained)"**. Do not re-deliberate this scheme — bump to the next .01 for each new verified change.

## v3 features (session 4)
Freeform AI question input · multi-select country filter · regression + moving-average trendline overlays on chart · select-all/deselect-all product buttons · orange five-point star favicon + in-app icon. All verified by extended real-Chrome e2e test.

## v4 features (session 5)
AI answer history (scrollable, newest on top; data stays visible while scrolling) · markdown rendering of AI answers incl. tables with horizontal scroll (inlined `marked` 12.0.2) · conversation caching: follow-up questions reuse the cached data context — no re-Analyze needed until filters change ("New analysis" button forces a fresh conversation).

## v5 features (session 6)
Full-data visibility for the AI: first request now includes the COMPLETE filtered dataset at month x product x country grain (~406 nonzero cells ≈ ~2,900 tokens for Historical_Data.csv), so the model can answer per-product/per-country monthly questions directly. Default system prompt updated to match. Follow-ups still reuse cached context (no re-send).

## v6 features (session 7)
In-flight progress indicator: while an analysis is running, a status entry at the top of the AI history shows an animated spinner + phase label ("Preparing…" → "Analyzing… (N KB sent to model)" → "Receiving response…") + a live elapsed timer ticking every 500ms. The Analyze button is disabled and relabeled "Analyzing…" while in-flight; on failure the elapsed time is included in the error line. A muted note explains that local models take 15s+ to warm up so long waits are expected (a non-streaming call returns no intermediate status, so timer + payload size is the truthful signal).

## v7 features (session 8)
Date-range filter: From/To date inputs in the sidebar restrict every view (chart, KPIs, country bars, AI payload); included in the AI context key so changing dates automatically starts a fresh conversation. CSV export of the filtered view: "Export CSV" button on the chart panel downloads `Date,Article_ID,Country_Code,Sold_Units` for exactly the current filter set as an ISO-dated filename (client-side Blob download; data never leaves the browser). Reset filters also clears the date range.

## v6.02 — V7 Phase 0: refactor & harden (session 10)
SalesCore restructured into eight named modules on the core namespace (**Schema, Store, Metrics, Charts, Insight, Text, Report, AI**); all legacy top-level names kept as aliases so existing tests pass unchanged. v6 defects fixed: no inline event-handler attributes remain in app source (all `addEventListener` + dataset), country bars and filter lists built with `createElement`/`textContent`, and markdown output passes through an inline HTML sanitizer (`Text.sanitizeHtml`) that strips script/style tags, on* attributes, and javascript: URLs. New light observable state container (`Store.create`: get/set/update/subscribe) now holds allRows/products/countries/selectedProducts/selectedCountries/aggMode/dateFromMs/dateToMs/aiCtx — filters no longer read from the DOM; `state` is reduced to the live Chart.js instance only. Harnesses grew per PRD: `.verify-core.js` adds module-presence, sanitizer, escapeHtml, store, CSV-builder, AI filterKey and buildLineSpec checks (15 total); `.verify-inline.js` asserts zero inline handlers in app source + all 8 modules exported. All regression anchors reproduce exactly; real-Chrome e2e passes 16/16.

## Next steps (in order, for future sessions)
The expanded `PRD.md` (V7 phased workbench) is authoritative over older planning documents. Phase 0 is complete and verified; Phases 1–10 remain.
1. Implement PRD **Phase 1: schema inference layer** — infer column roles (date/numeric/text/id), confirm with the user before analysis, keep the fixed 4-column path working as a fallback. Bump header tag to v6.03 when verified.
2. Continue Phases 2–10 in order; each phase bumps the header tag by .01 per the versioning policy above and must grow + pass both verify harnesses.
3. User-side confirmation: open v6.02 in their browser and load `Historical_Data.csv` (should show "4,849 valid rows" + KPIs); exercise filters/aggregation/AI panel against at least 3 OpenAI-compatible providers (PRD success metric), including follow-up questions to confirm context caching.
4. If requested: add a README.md pointing to the repo + run instructions.

## Decisions already made (do NOT re-deliberate)
- Single self-contained `index.html`; PapaParse, Chart.js and marked are inlined (no CDN, no npm/build).
- Weekly buckets start Monday; monthly = calendar months.
- Trend = linear regression slope on filtered series; seasonality = strongest month-of-year average vs overall mean.
- GitHub repo created via `gh` CLI (logged in as joenobk), public, name `sales-analytics-tool`.

## Loop-trap guardrails (from .instructions.md)
No identical repeated tool calls without new info · ≤2 failures per path then switch strategy · verify progress every ≤5 tool calls · decide once and proceed.
