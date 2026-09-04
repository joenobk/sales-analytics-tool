# Plan: Sales Analytics Tool v6 → v7

A phased, chunked build plan. Each **chunk** is sized to fit one session with a limited context window: read `CONTEXT.md`, do exactly one chunk, verify, update the core files, hand off. Do not let a session skip ahead — Phase 1 (schema) is the foundation everything else stands on.

## How a session runs (handoff protocol)
1. Read `CONTEXT.md` → it points at the next chunk ID below.
2. Do **only** that chunk. Keep the diff focused; one coherent capability per session.
3. Verify: run both harnesses (`node .verify-core.js`, `node .verify-inline.js`). When DOM, AI, or a new library is involved, also do a real-Chrome (puppeteer-core) e2e — jsdom can't exercise PapaParse's File-streaming path.
4. Update the five core files: append a `DEVLOG.md` entry (with "Loop traps hit"), point `CONTEXT.md` at the *next* chunk, keep `.instructions.md` under 100 lines, refresh `PRD.md`, leave `.env` uncommitted with real keys.
5. Commit + push; git status clean before closing.

## Baseline invariants (must hold until a phase intentionally changes them)
- Single self-contained `index.html`; all libs inlined; opens from `file://` with no network. No CDN refs.
- v6 numbers on `Historical_Data.csv`: 4,849 valid rows, grand total **9,537** units. By country SE:3469 / FR:2865 / FI:1873 / AT:1330. Top product 3448 (1163), bottom 1579 (317). Trend slope +15.33/month; seasonality peak November (+46.8%).
- No code execution from model output (no eval/new Function/model text as HTML); markdown always sanitized; API key in localStorage only, never exported.

## Chunks

### Phase 0 — Refactor & harden
**C0a · core namespace + state container.** Split the SalesCore logic into named modules on a `core` namespace: Schema, Store, Metrics, Charts, Insight, Text, Report, AI (empty shells where a phase hasn't landed yet). Introduce one light observable **state container** holding filters, datasets, chart specs, and AI context — stop reading filters back out of the DOM. Behavior identical; v6 numbers unchanged. *Verify: both harnesses pass.*

**C0b · defect hardening.** Replace inline `onchange="App.onFilterChange()"` string-concatenated handlers with `addEventListener` + `dataset`. Escape all `innerHTML` writes (or use `textContent`). Inline a small HTML sanitizer and route **all** markdown through it before render. *Verify: harnesses pass; real-Chrome e2e confirms filters/AI still work.*

### Phase 1 — Schema inference layer *(foundation)*
**C1a · type + role inference.** Infer column types (date/number/categorical/text) and roles (time, measure, dimension, id, label). Generalize `parseCsvData` to accept any columns via a schema object instead of the hard-coded 4-column contract; Historical_Data.csv must still parse by inference. *Verify: extend `.verify-core.js` to assert inferred types/roles on the sample CSV.*

**C1b · mapping UI.** Let the user override column type/role per dataset and persist the mapping (localStorage, keyed by dataset). *Verify: e2e — change a role, reload, mapping persists; v6 numbers intact.*

### Phase 2 — Entity & concept resolution *(intelligence-heavy)*
**C2a · entity registry + identifier hygiene.** ID+label pairing, an entity registry, and normalization (trim/case/format) so the same product/account/rep/territory is recognized across files. *Verify: harness asserts two differently-formatted IDs resolve to one entity.*

**C2b · fuzzy matching + synonyms + geography.** Fuzzy cross-dataset concept alignment with a synonym dictionary; handle geography fields. **Intelligence needed:** pick fuzzy-match thresholds and seed the synonym dictionary — decide before this session (see "Prepare" below).

**C2c · hierarchies + missing-data handling.** Support hierarchical dimensions (e.g., region→country) and define how blanks/nulls are treated per role. *Verify: harness covers a hierarchy roll-up and a null-measure row.*

### Phase 3 — Multi-dataset registry
**C3a · dataset registry + xlsx + filter bus.** Register multiple CSVs; add SheetJS (inlined) for `.xlsx`; introduce the global filter bus so filters apply across datasets. *Verify: harness loads two small CSVs; e2e confirms a shared filter.*

**C3b · joins via concepts.** Join datasets on resolved concepts (not raw column names). **Intelligence needed:** confirm join semantics (inner/left, key = concept id) before starting.

### Phase 4 — Declarative metric engine
**C4a · metrics + computed fields.** Define metrics declaratively with agg types (sum/avg/count/min/max/distinct) and support computed fields (expressions over columns). *Verify: harness asserts a computed field and an avg metric.*

**C4b · metric packs + period comparison.** Group metrics into packs by kind; add period-over-period comparison. *Verify: harness asserts a MoM delta.*

### Phase 5 — Spec-driven chart renderer
**C5a · JSON spec renderer.** Render charts from schema-validated JSON specs (replaces the single hard-coded chart path). This is where model-authored charts will land later. *Verify: harness validates + renders a spec; rejects an invalid one.*

**C5b · cross-filtering + drill-down.** Clicking a bar/point filters other views and drills down dimensions. **Intelligence needed:** decide the drill-down order/priority for multi-dimension data.

### Phase 6 — AI-as-analyst tool loop
**C6a · transports + opening analysis.** Two transports (fetch streaming / SSE); run an opening deterministic analysis on load; stream tokens into the sanitized panel. *Verify: e2e with a stubbed API streams and renders safely.*

**C6b · tool-based queries (replace the blob).** Give the model tools that run deterministic queries against state; retire `buildFullDataPayload`'s full-cube text blob. Model-authored charts arrive as JSON specs validated before render. **Intelligence needed:** choose the model + confirm the tool schema — decide before this session.

### Phase 7 — Verification layer
**C7a · cited figures + claim check.** Every number in AI output must match a deterministic query (automated claim check); add provenance footers, show-the-math, and a definition registry. **Intelligence needed:** the claim-checker's matching rules are subtle — design them carefully; this is the highest-risk intelligence chunk.

### Phase 8 — Text analytics
**C8a · two-pass taxonomy.** Extract themes + sentiment from call/activity text via a two-pass approach (classify, then aggregate). **Intelligence needed:** define the theme taxonomy and what "call/activity" data looks like before starting.

### Phase 9 — Importance & visual clarity
**C9a · severity + attention strip + sparklines.** Score findings by importance; add an attention strip and trend sparklines. *Verify: harness asserts a severity ordering.*

**C9b · themes + saved views.** Persist named saved views (filters + charts) without exposing the API key. **Intelligence needed:** decide what a "saved view" may store (never secrets).

### Phase 10 — QBR report builder
**C10a · report assembly.** Assemble a Quarterly Business Review from metrics, charts, and text findings; every figure traces to source rows. *Verify: e2e builds a report from sample data.*

**C10b · PDF export.** Export the assembled report to PDF (inlined lib). **Intelligence needed:** pick the QBR template/sections — decide before this session.

## Intelligence to prepare (call out before the session that needs it)
- **C2b:** fuzzy-match thresholds + seed synonym dictionary (product/account/rep/territory aliases).
- **C3b:** join semantics (type, key = concept id vs label).
- **C5b:** drill-down dimension priority.
- **C6b:** which model to use + the tool-call schema for deterministic queries.
- **C7a:** claim-checker matching rules (how an AI-stated number is matched to a query result, tolerance/rounding).
- **C8a:** theme taxonomy + sample call/activity text shape.
- **C10b:** QBR report template and section list.

## Prior plan (v6 build — complete)

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
