# PLAN — Sales Analytics Tool: Session Chunks

Execution model: one chunk per session (or per work block). Each chunk has a goal, deliverable, and exit check. Do not start the next chunk until the previous exit check passes. If a chunk fails its exit check twice, stop and re-plan (see loop-trap rules in `.instructions.md`).

**Repo:** https://github.com/joenobk/sales-analytics-tool (branch `main`)

## Chunk 0 — Scaffolding ✅
- **Goal:** Establish project files per `AI_Workspace_Architecture_Guide_v5.md` + loop-trap guardrails.
- **Deliverables:** PRD.md, .instructions.md, DEVLOG.md, CONTEXT.md, .env (+ .gitignore), this PLAN.md.
- **Exit check:** All five core files exist; `.instructions.md` < 100 lines and contains the loop-trap section.

## Chunk 1 — Core app: ingestion + chart (index.html)
- **Goal:** Single-file `index.html`, no build step, CDN deps only (PapaParse, Chart.js).
- **Deliverables:** File picker + drag-drop; column validation with clear errors; YYYYMMDD → Date parsing; time-series chart of units sold; product & country filters; day/week/month aggregation toggle.
- **Exit check:** Loading `Historical_Data.csv` (4849 rows) renders a correct daily series; filters and aggregation visibly change the chart; bad CSV shows an error, not a crash.

## Chunk 2 — KPIs + insights
- **Goal:** Summary dashboard for the filtered view.
- **Deliverables:** KPI cards: total units, top product, bottom product, sales by country (sorted list/bar); trend direction (linear regression slope) and seasonality signal (strongest month-of-year vs mean).
- **Exit check:** KPIs recompute on every filter/aggregation change; values match hand-checked numbers for a known filter.

## Chunk 3 — AI "Analyze" panel
- **Goal:** OpenAI-compatible chat completions integration with graceful fallback.
- **Deliverables:** Settings UI: base URL, API key (localStorage), model name, temperature slider, editable system prompt; "Generate AI Insights" sends a compact summary of the *filtered* data (not raw CSV); displays model output; copy-to-clipboard button; when unconfigured or on failure → statistical summary (mean/median/growth rate) still shown.
- **Exit check:** With no API configured, clicking Analyze shows the statistical fallback without error; with a valid endpoint config, request shape matches OpenAI chat completions spec.

## Chunk 4 — Verification + polish
- **Goal:** Prove it works end-to-end on real data.
- **Deliverables:** Headless/logic check of parse+aggregate against `Historical_Data.csv`; confirm single command to run (just open the file, or `npx serve`/any static server); fix anything found.
- **Exit check:** All PRD success metrics met; no console errors on load with sample data.

## Chunk 5 — GitHub repo + push
- **Goal:** Version-controlled project in GitHub.
- **Deliverables:** `git init`, initial commit (all files except `.env`), remote repo created via `gh`, pushed, URL recorded here and in DEVLOG.md.
- **Exit check:** Remote branch exists with all committed files; `.env` verified absent from the repo (`git ls-files`).

## Chunk 6 — Close-out
- **Goal:** Session hygiene per guide workflow loop.
- **Deliverables:** DEVLOG.md entry for final session; CONTEXT.md updated to "next step" (e.g., provider integration tests across OpenAI/Groq/Ollama).
- **Exit check:** `git status` clean; all five core files current.

## Chunk 7 — AI-guided multi-file discovery & onboarding (PRD Phase 11)
> The expanded `PRD.md` (V7 phased workbench) is authoritative over the older chunks above; this chunk maps to PRD **Phase 11** and is built after Phases 0–10 are verified.
- **Goal:** Let a user point the tool at a folder of data files (or batch-select them) and have it review all of them together, propose how each should be mapped, joined, and analyzed via the existing AI endpoint, and present a review board for the human to confirm or adjust before anything loads.
- **Deliverables:** Folder/batch intake (`webkitdirectory` + multi-select); a deterministic local pre-profile per file (Phase 1 inference + Phase 2 concepts + Phase 3 join candidates); a bounded corpus-summary payload (headers, types, ≤5 samples, distinct/null counts, date ranges — never full rows) sent to the AI for a structured JSON blueprint (dataset kinds, role/concept corrections, join graph, analysis plan); a **Review Board** UI (per-file mapping diff, join graph, analysis plan) with **Accept all** / **Accept inferred** / **Reject** plus per-item confirm/adjust/reject; apply confirmed proposals through the existing load path; persist confirmed review keyed by a file-shape hash for auto-reapply; graceful fallback to the local profile when AI is unconfigured. Grounded in the sample corpus (contact-centric CRM/ERP chain): extend the concept vocabulary to cover contact/lead/sale/sale-line, and support multi-hop join paths (e.g. revenue per contact via SaleLine→Sale→Contact) rather than only pairwise edges.
- **Exit check:** Pointing the tool at a folder of seven mixed exports lists all seven in the review board with inferred kinds, proposed joins, and an analysis plan; confirming loads all datasets with the joins declared; the serialized AI payload contains no full data rows; with AI unconfigured the review board still works from the deterministic profile; `node .verify-core.js` and `node .verify-inline.js` both pass with the new Phase 11 assertions.
