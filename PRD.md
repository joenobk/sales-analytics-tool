# PRD: Sales Analytics Workbench V7

## Goal and scope

Upgrade the existing V6 sales analytics tool into a schema-agnostic, multi-dataset analytics workbench for sales analysts and business owners. Resolve business entities across inconsistent exports, provide immediate deterministic analysis, support manual and AI-assisted chart building, analyze customer text, and assemble a traceable Quarterly Business Review (QBR).

The deliverable remains one self-contained `index.html`, opened directly from `file://`, with no backend, installation, or build step. Analytics work offline; optional AI uses the user-configured local or remote OpenAI-compatible endpoint.

This document integrates the original PRD with the attached **Build Prompt: Sales Analytics Tool v6 to v7**. V7 requirements supersede conflicting original requirements. This is an implementation specification, not a claim that V7 is implemented. Build Phase 0, then Phases 1–10 in order; Phase 1 is the schema foundation. Each phase must leave a working file.

## Success metrics and retained behavior

- Retain interactive startup in under two seconds and a first chart within 30 seconds of upload for the original fixture, including mapping confirmation. Assess large-file performance separately against the 500,000-row, 40-column target.
- Load `Historical_Data.csv` (4,849 rows; `Date`, `Article_ID`, `Country_Code`, `Sold_Units`) and reproduce V6 results exactly. Recorded regression anchors: 9,537 total units; top product 3448 with 1,163 units; bottom product 1579 with 317 units; country totals SE 3,469, FR 2,865, FI 1,873, AT 1,330. Day/week/month totals must agree.
- Retain file-picker and drag-and-drop ingestion, multi-select product/country filtering, daily/weekly/monthly aggregation, units KPIs, top/bottom products, country breakdown, trend and seasonality, regression and moving-average overlays.
- Retain configurable endpoint/base URL, API key, model, temperature and editable system prompt; localStorage settings; freeform questions; copy-to-clipboard; answer history and conversation caching. Editable prompts cannot bypass validation or verification.
- Preserve a deterministic statistical summary (mean, median and growth where supported) when AI is unconfigured or fails. Select native tool calling or the constrained JSON fallback according to endpoint capability.
- Preserve the upload/settings bar, collapsible filter sidebar, central charts/KPIs and adjacent AI panel while adding dataset navigation and report assembly.
- All final acceptance checks below are required. Phase completion uses the repository's actual commands: `node .verify-core.js` and `node .verify-inline.js`.

## Reconciled requirements and interpretation

- **Schema:** The original four-column contract is a regression fixture, not a restriction on new files. V7 supports inferred, confirmed schemas and multi-sheet workbooks.
- **Dependencies:** The original CDN allowance is superseded. Inline PapaParse, Chart.js, marked, the sanitizer, SheetJS and any additional required rendering support. No runtime dependency downloads.
- **AI context:** Replace the original summary-only request and V6 full-cube payload with bounded deterministic queries and result IDs. Only configured AI requests may transmit data; customer text requires the Phase 8 privacy gate.
- **Missing periods:** Retain the legacy zero-sales-gap interpretation for the original sales workflow. Do not assume missing periods mean zero activity or revenue in arbitrary datasets; surface gaps and make dataset-specific treatment explicit.
- **Calendar and definitions:** Weeks begin Monday and months follow calendar boundaries. Fiscal quarter start is configurable, defaulting to January. Preserve linear-regression trend and the legacy strongest month-of-year average versus overall mean for regression compatibility; register additional definitions explicitly.
- **Partial data:** Enable metrics only when required fields, relationships and history exist. Slipped deals require close-date history; weighted pipeline requires probabilities; coverage requires a target. Show missing prerequisites instead of inventing values.
- **Manual equivalents:** Mapping, entity reconciliation, metric/chart configuration, taxonomy editing, text labeling and report assembly remain usable without AI. Manual labeling uses the same locked taxonomy and derived-column contracts. Report templates and deterministic figures work without generated narrative.
- **Authority:** Unsupported model numbers remain visibly unverified under Phase 7 and cannot become authoritative KPI values, chart series or cited report figures. Preserve unresolved verification status in reports.
- **Reproducibility:** Saved views contain configuration and dataset references, never keys. Rebuilding requires matching source files and mappings; view JSON does not itself embed those files. Provenance refers to the query/filter snapshot that produced a figure even after live filters change.

## V6 baseline and remodeling context
You are upgrading an existing single-file analytics tool. Read index.html fully before writing anything. Baseline described by the remodeling plan; inspect the implementation before building:

One self-contained HTML file, roughly 306 KB, with PapaParse, Chart.js, and marked inlined so it runs offline from file://.
Clean separation already exists: SalesCore is pure DOM-free logic exported to both window and module.exports, and App holds all DOM wiring. Preserve that discipline.
A Node headless test harness (.verify-core.js) extracts the SalesCore block and asserts on real data. .verify-inline.js asserts the file has no CDN dependencies. Both must keep passing and must grow with every phase.
Hard limits in v6 that this rebuild exists to remove:
parseCsvData requires exactly four columns: Date (YYYYMMDD only), Article_ID, Country_Code, Sold_Units. Anything else is rejected outright.
One dataset at a time. One chart type. One measure, always summed.
The AI panel sends a text blob (buildFullDataPayload) containing the entire month by product by country cube. This does not scale, and the model can say anything about it with no verification.
Known defects to fix in passing: inline onchange="App.onFilterChange()" handlers built by string concatenation with unescaped values, innerHTML writes of unescaped country codes, and model output rendered through marked straight into innerHTML with no sanitizer.

Target: a schema-agnostic, multi-dataset analytics workbench that resolves the same product, account, rep, and territory across files that name them differently and fill them in unevenly, opens with an immediate read on whatever data it is given, lets an analyst and an AI build charts together, extracts themes and sentiment from call and activity text, and assembles a defensible Quarterly Business Review where every figure traces back to source rows.


## Non-negotiable constraints
- Single file, offline. One index.html. All libraries inlined. Must open from file:// with no network. This is how the tool gets used, do not trade it away.
- Source data is the authority. The AI never states a number it did not receive from a deterministic query this app ran. Enforced in code, not just in the prompt. See Phase 7.
- No code execution from model output. No eval, no new Function, no injecting model text as HTML. Model-authored charts arrive as JSON specs that are schema-validated before rendering. All rendered markdown passes through a sanitizer.
- AI is additive, never load-bearing. Every AI capability has a manual equivalent. With the API unconfigured the tool is still a complete analytics tool, degrading to the deterministic engine.
- Performance target: 500,000 rows, 40 columns, no UI freeze. Parse and aggregate in a Web Worker, columnar storage with typed arrays for numeric and date columns, dictionary encoding for categoricals, LTTB downsampling for series over about 2,000 points.
- Secrets: API key lives in localStorage only. Never written into an export, a report, or a saved view.
- Tests grow with the code. Every phase adds assertions to the headless harness. A phase is not done until node .verify-core.js and node .verify-inline.js both pass.


## Phase 0: Refactor and harden
Restructure the logic block into named modules inside the single file, each independently testable and each exported on the core namespace: Schema, Store, Metrics, Charts, Insight, Text, Report, AI.

Fix the defects listed above. Replace inline handler strings with addEventListener and dataset attributes. Escape everything written through innerHTML, or build nodes with textContent. Inline a small HTML sanitizer and run all markdown output through it.

Add a light state container so filters, datasets, chart specs, and AI context live in one observable object rather than being read back out of the DOM. Reading selected filters by querying checkbox nodes is the root of several v6 limitations.


## Phase 1: Schema inference layer
This replaces the hard-coded four-column contract. Nothing else in this spec is possible without it.

Column type inference. For each column, sample up to 1,000 non-empty values and classify:

date: accept YYYYMMDD, ISO 8601, MM/DD/YYYY, DD/MM/YYYY (disambiguate by scanning for a value with day above 12, ask if genuinely ambiguous), Mon YYYY, quarter strings like 2026-Q1, and Excel serial numbers. Store the detected format and show it in the mapping panel.
number: integers, decimals, and currency or percent strings after stripping symbols, thousands separators, and parentheses-as-negative.
boolean: true/false, yes/no, 1/0, won/lost.
categorical: string column where distinct count is under 5% of rows or under 50 absolute.
identifier: high-cardinality string or integer, near one distinct value per row.
text: strings with mean length above roughly 80 characters or low repetition. These feed Phase 8.

Role assignment. Each column gets a role: time, dimension, measure, identifier, text, geo, or ignore. Infer from type plus name patterns (amount, revenue, qty, units, spend, stage, owner, region, close_date, created, disposition, notes, transcript, sentiment). Numeric identifiers must not become measures: an Article_ID of 3417 is never summed. Guard with a name-pattern check plus a distinctness heuristic, and default any ambiguous numeric column to dimension rather than measure.

Confirmation UI. A mapping panel listing every column with its inferred type, role, sample values, null count, and distinct count, all overridable by dropdown. Nothing loads silently on a guess. Persist the confirmed mapping keyed by a hash of the sorted header set, so the same file shape maps instantly next time.

Optional AI assist. A button that sends only headers, inferred types, and five sample values per column, and receives a proposed role map plus a suggested dataset kind and a one-line description of what the file appears to be. The user confirms before it applies. The model labels columns, it never invents or transforms values.

Test additions: each supported date format parses correctly, an ID-shaped integer column is not classified as a measure, a currency string column parses to numbers, a mapping round-trips through localStorage.


## Phase 2: Entity and concept resolution
Real files carry the same business entity under different names, at different completeness, in different shapes. One file has Product_Number, another has SKU plus Product_Name, a third has only a description. Accounts arrive as an ID in one export and a name in another, sometimes with an address, sometimes with a territory, sometimes with a rep, often not all three. This phase is where the tool earns its keep, and it is the difference between a tool that works on one export and a tool that works on whatever the business hands over.

Concept layer. Above raw columns, maintain a set of business concepts: product, account, rep, territory, geography, campaign, opportunity, activity, time, amount. Columns bind to concepts. Filters, joins, and metrics address concepts, not column names, which is what lets one filter apply across four differently shaped files.

Identifier and label pairing. Detect when two columns describe one entity, an ID and a human label, by name pattern (*_id, *_number, *_code, *_no paired with *_name, *_desc, *_title) and by cardinality relationship (a near one-to-one mapping where one side is high-entropy and the other is readable text). Bind them into one entity reference. Then:

Group and join on the ID, always. Display the label, always. Search and filter match either.
Handle all four real cases: ID only (display the ID, note that no label exists), label only (treat the normalized label as a surrogate key and say so), both present, and both present but inconsistent.
When one ID maps to multiple labels, surface it as a conflict with the competing values and their row counts. Resolve by an explicit rule the user picks, most frequent, most recent by load time, or manual choice. Never silently pick one.

Entity registry. Build a dimension table per concept as the union of every attribute seen across all loaded datasets. An account may pick up its name from the CRM export, its address from a billing file, its territory from a mapping sheet, and its rep from an activity log. The registry holds the merged record with per-attribute provenance, so every attribute knows which file it came from. Attribute conflicts across sources are surfaced, never merged away silently.

Fuzzy matching, with a human in the loop. When only names are available to join on, normalize before comparing: trim, collapse whitespace, case fold, strip punctuation, strip corporate suffixes (Inc, LLC, Ltd, Corp, Co, GmbH), and sort tokens. Score candidates with a string similarity measure. Auto-accept only above a high threshold. Everything in the uncertain band goes to a review queue where the user confirms or rejects proposed matches, with the row counts on each side visible. Persist confirmed matches so the same reconciliation never has to be done twice. Never auto-merge two entities on a weak match, a wrongly merged account is worse than an unmerged one.

Identifier hygiene, do not skip this. Read all identifiers as strings, never as numbers. Preserve leading zeros: account 00123 and account 123 are different accounts, and coercing them together silently corrupts the analysis. Keep the original value for display and a normalized value for joining. This alone prevents a whole class of quiet errors.

Addresses and geography. Accept either component columns (street, city, state, postal, country) or a single free-text address field, and extract what is confidently parseable from the latter without guessing the rest. Normalize country and state or province to standard codes while keeping the original string. Build the geographic hierarchy from whatever levels are present: country, state or region, city, postal. When only a postal code exists, treat it as the finest available level rather than inventing a city. Geography powers rollups and, where it is clean enough, a map view.

Hierarchies. Detect containment automatically: when every occurrence of value A in column X coincides with a single value in column Y, X likely rolls up into Y. Offer the detected hierarchy for confirmation, then enable drill-down and roll-up along it. Common cases: territory into region into country, rep into manager, product into category into line. Confirmed hierarchies are saved with the mapping.

Synonym dictionary, and it learns. Ship a starter dictionary of header aliases per concept, for example account (acct, customer, client, company, account_name, cust_id), rep (owner, ae, salesperson, sales_rep, assigned_to), product (sku, item, article, part_number, material), territory (terr, region, area, zone, district). When a user overrides an inferred binding, record the header-to-concept mapping and reuse it on future files. The tool should get measurably better at the user's data with every file it sees.

Missing data is the normal case, treat it as first class. Every concept is optional. The UI shows only the filters, charts, and metric packs that the loaded data can actually support, rather than rendering empty controls. Add a data coverage panel listing each concept with its fill rate, which dataset provides it, and plainly what it unlocks or blocks: "Territory present on 62% of accounts, territory rollups will cover 62% of revenue." That number goes on any chart broken out by that concept, so nobody reads a partial view as a complete one.

Tell the AI what is absent. The schema description passed to the model must state explicitly which concepts are missing and which are partial, with fill rates. A model that knows there is no cost column will say margin cannot be computed. A model that does not know will estimate one. This is a direct extension of the source-data-is-authority rule.

Test additions: an ID and name pair binds into one entity and groups by ID while displaying the name, leading zeros survive load and join, one ID with two names raises a conflict rather than picking silently, a weak fuzzy match lands in the review queue rather than auto-merging, a confirmed alias persists and applies to a second file, a concept absent from all datasets hides its filters and is reported in coverage, and the schema payload sent to the model names the missing concepts.


## Phase 3: Multi-dataset registry
Support loading several files, and multi-sheet workbooks. Inline SheetJS for .xlsx and treat each sheet as a candidate dataset.

Each dataset carries: id, display name, source filename, load timestamp, row count, schema, and a kind chosen at load from transactions, opportunities, campaigns, activities, or generic. Kind is a hint that unlocks a metric pack, never a hard schema requirement, so a partial file still works.

Relationships. Joins are declared between concepts, resolved through the Phase 2 entity registry rather than raw column equality, so activities.acct joining opportunities.Account_ID works even though the headers differ. Propose likely joins automatically from shared concepts and confirmed entity matches, and let the user confirm, edit, or add. Support left-join enrichment lookups, not a general query engine. Build the join index once at declaration time, hash-based, and reuse it.

Global filter bus. One filter set applies across all datasets. A filter on a field applies to any dataset that has a column mapped to that concept and is skipped for datasets that do not, with a visible note saying which datasets a given filter reaches. Date range is the universal filter: every dataset with a time column respects it.

Navigation. Tabs or a switcher per dataset, plus an overview tab that shows cross-dataset KPIs once relationships are declared.

Test additions: two datasets load without collision, a declared join resolves correct lookups, a filter on a field absent from dataset B leaves B unfiltered and reports that.


## Phase 4: Metric engine
Replace hard-coded summation with declarative measures: {field, agg} where agg is one of sum, avg, median, count, countDistinct, min, max, rate. Add computed fields defined as safe expressions over existing columns, parsed by your own small expression parser, never eval.

Metric packs by kind, all deterministic:

transactions: total units and revenue, average order value, period growth, linear trend, seasonality by calendar month, concentration (top-N share and a Herfindahl index for dependence risk).
opportunities: open pipeline value, weighted pipeline by stage probability, win rate, average deal size, sales cycle days, stage-to-stage conversion, slipped deals (close date moved), pipeline coverage against a target.
campaigns: spend, leads, cost per lead, conversion rate, and where a join to opportunities exists, influenced pipeline and return on spend.
activities: volume by type and by owner, connect and completion rate, time to first touch, activity per opportunity, and after Phase 8, sentiment distribution and theme frequency.

Period comparison is the QBR backbone. Every metric computes for the selected period, the prior equivalent period, and the same period one year earlier, returning absolute and percentage deltas. Quarter boundaries configurable for a non-calendar fiscal year.

Every metric returns a traceable object, not a bare number: {value, formatted, definition, agg, field, rowsUsed, filterState, datasetId}. This object is what Phase 7 verifies against and what "show the math" displays.

Test additions: each agg is correct against a fixture, quarter boundaries respect a fiscal offset, period comparison handles a missing prior period without throwing, rowsUsed matches the actual filtered count.


## Phase 5: Spec-driven chart renderer
Charts become data, not code. A chart is a validated JSON spec. The following is a contract sketch; submitted specs must be strict JSON:

```text
{

  id, title, datasetId,

  type: "line"|"bar"|"stackedBar"|"groupedBar"|"area"|"scatter"|"heatmap"|"funnel"|"waterfall"|"pareto"|"smallMultiples"|"table",

  x: { field, bucket: "day"|"week"|"month"|"quarter"|"year"|null },

  y: [ { field, agg, label } ],

  splitBy: field|null,

  filter: [...],

  sort, limit,

  overlays: ["regression","movingAverage","target","priorPeriod"],

  annotations: [ { at, label, severity } ]

}
```

One renderer consumes the spec, pulls values from the metric engine, and draws with Chart.js. Charts are addable, removable, reorderable, duplicable, and pinnable to the report. A chart builder UI writes the same spec the AI writes, so both paths go through one validated code path.

Cross-filtering. Clicking a bar, a legend entry, or brushing a date range adds a filter chip to a visible chip bar. Chips show exactly what is filtered and are individually removable. The user must never be uncertain about what subset they are looking at.

Drill-down. Any chart point opens the underlying rows in a virtualized table, exportable to CSV.

Test additions: an invalid spec (unknown field, unknown agg, measure role on a dimension) is rejected with a specific error and never reaches the renderer, each chart type produces correct series data from a fixture.


## Phase 6: AI as an analyst with tools
Replace the "send the whole cube as text" approach with a tool loop. The model requests computations, the app performs them deterministically, and the model reasons over real returned values.

Tools to expose:

list_datasets() returns names, kinds, row counts, date ranges.
describe_schema(datasetId) returns columns with types, roles, distinct counts, and sample values.
query({datasetId, dimensions, measures, filters, timeGrain, sort, limit}) returns compact rows plus a resultId. Cap returned rows, and when the cap truncates, say so in the result.
compare_periods({metric, period, comparison}) returns current, prior, delta, and percent.
create_chart(spec) validates and renders, returns the chart id.
get_chart_data(chartId) returns the exact series behind a rendered chart so the model can comment on what is actually on screen.
extract_text_insights({datasetId, field, options}) runs the Phase 8 pipeline.

Two transports. Use native tool or function calling where the endpoint supports it. Where it does not, which is common with smaller local models, fall back to a constrained protocol: the model emits a single fenced JSON block {"tool": "...", "args": {...}}, the app parses, executes, and returns the result as the next message. Same loop, no native support needed. Cap the loop at a configurable number of turns and always show the user which tools ran, with their arguments and result sizes.

Opening analysis on load. The instant a dataset is mapped, run a deterministic profile and render it immediately: coverage, row counts, date range, gaps in the series, null rates, cardinalities, outliers beyond two sigma, top and bottom performers, trend, seasonality, concentration. Do not block on the model. Then ask the model, with tools available, for a structured opening read:

What this data covers and what it can and cannot answer.
Three to five findings, each with the computed figure and the query that produced it.
Two or three questions worth asking next, offered as clickable prompts.
Two or three suggested charts, offered as one-click create_chart specs.

Streaming. Use SSE streaming so a slow local model shows tokens rather than a spinner and an elapsed timer. Keep the elapsed timer as a fallback for non-streaming endpoints. Keep the existing conversation caching, but key it on the full state (datasets, filters, chart set) rather than only products and countries.

Test additions: the fallback JSON protocol parses a valid tool block, a malformed block produces a corrective message rather than a crash, the loop terminates at the cap.


## Phase 7: Verification layer, so the source data is the authority
This is the feature that makes the tool usable in an executive review. Build it, do not treat it as polish.

Cited figures. The system prompt requires every numeric claim to cite the resultId that produced it, in an inline form the app can parse. Render citations as chips. Clicking a chip shows the query, its filters, and its returned rows.
Automated claim check. After each response, extract every number from the model text and match it against the values in that turn's tool results within a small tolerance. Any number with no match is visibly marked "unverified" in the rendered answer. Do not silently delete it, show the user exactly which claims are not backed by a query. Report a per-answer verified count.
Empty result honesty. When a query returns no rows, the model must say so. Add a hard instruction, and treat an unverified figure appearing after an empty result as a flagged fabrication.
Provenance footers. Every chart, KPI, and report section carries source dataset, source filename, load timestamp, filters applied, metric definition, and rows used.
Show the math. A toggle on any KPI that opens the exact filter set, aggregation, row count, and a link to the contributing rows.
Definition registry. One place where every metric definition lives, surfaced on hover. Two people reading the QBR must not be able to disagree about what "win rate" means.

Test additions: an answer containing a fabricated number is flagged, an answer whose numbers all appear in tool results is fully verified, provenance survives a filter change.


## Phase 8: Text analytics for call and activity data
For columns with the text role, typically call notes, dispositions, transcripts, or comment fields.

Two-pass taxonomy, this ordering matters. Naive per-row classification produces category drift and a hundred near-duplicate themes.

Pass 1, propose: sample a few hundred rows, ask the model for a candidate taxonomy of roughly 8 to 15 categories with definitions and example phrases. Present it in an editable panel where the user renames, merges, deletes, and adds categories. The taxonomy is then locked.
Pass 2, classify: run all rows against the locked taxonomy in batches, with a strict JSON output schema per row: {sentiment: -1..1, sentimentLabel, categories: [from taxonomy only], keyPhrases: [], escalationFlag: bool, confidence: 0..1}. Reject and retry any output that names a category outside the taxonomy.

Operational requirements:

Cache results by hash of the text, so re-runs and re-filters cost nothing.
Show progress, an estimated time, and a working cancel button. This will be the slowest thing the tool does.
Write results back as derived columns on the dataset, so sentiment and category become ordinary filterable dimensions and chartable measures. Sentiment over time, themes by rep, escalation rate by region, all fall out of the existing engine for free.
Every theme drills to verbatim rows. No theme is displayed without the ability to read the actual text behind it. A theme with no evidence is not a finding.
Report low-confidence and unclassified rows honestly rather than forcing everything into a bucket.
Privacy gate: before sending customer text to a remote endpoint, warn clearly and recommend routing this step to a local endpoint. Remember the choice per endpoint.

Test additions: a classification naming an off-taxonomy category is rejected, the cache prevents a duplicate call, derived columns are filterable through the normal filter path.


## Phase 9: Importance, hierarchy, and visual clarity
Deterministic severity scoring. Every KPI gets a signal score from magnitude of change, statistical significance against historical variance (a z-score versus the trailing window), and concentration risk. Levels: critical, watch, normal, positive. The score is computed by the engine, not asked of the model, so it is stable and explainable. The model may narrate a severity, it may not assign one.

Visual encoding:

An "Attention" strip at the top, holding only items scoring critical or watch, sorted by score, empty and hidden when nothing qualifies. Do not manufacture urgency.
Color band plus left border on cards by severity, always paired with an icon and a text label, never color alone.
Sparkline on every KPI card, with delta against prior period and a direction arrow.
Anomaly markers on time series for points outside two sigma of a rolling window, annotated with date and magnitude.
Confidence and sample-size indicators wherever a figure rests on few rows. A 100% win rate on three deals must not look like a 100% win rate on three hundred.

Layout and usability:

Light and dark themes, both accessible, contrast checked.
Collapsible filter sidebar, searchable filter lists with counts per value, and virtualized lists so a thousand product IDs do not lock the browser.
Saved views: named bundles of filters, chart specs, and layout, saved to localStorage and exportable as a small JSON file, so a QBR view is reproducible next quarter.
Keyboard shortcuts for the common path, and a responsive layout that survives being projected in a conference room.


## Phase 10: QBR report builder
Assembly. Pin any chart, KPI, insight, or theme to a report outline. Reorder by drag. Add free-text sections.

Auto-draft. Pick a quarter, then generate a structured draft:

Headline metrics, quarter over quarter and year over year.
What drove the change, with the contributing cuts shown.
Pipeline health: coverage, win rate, cycle time, stage conversion.
Campaign efficiency and where spend produced pipeline.
Customer voice: sentiment trend and top themes, each with verbatim evidence.
Risks, concentration, and anomalies.
Recommended actions, each tied to the figure that motivates it.

Every section carries its provenance footer and every figure carries its citation.

Export: print-optimized HTML that produces a clean PDF through the browser print dialog, plus a CSV appendix of every figure cited in the report, plus the saved-view JSON so the exact analysis can be rebuilt. Optional speaker notes per section.


## Acceptance checks
- The build is done when all of these pass:

- Loads the original Historical_Data.csv and reproduces v6 numbers exactly. This is the regression test that proves nothing broke.
- Loads a CSV with 15 columns, ISO dates, a currency measure, and three dimensions, with no code changes, and produces a correct opening analysis.
- Loads a file with Product_Number and Product_Name, groups by number while displaying name, and a second file using SKU and Item_Description for the same products resolves to the same entities.
- Loads an account file where 60% of rows have a territory and 80% have a rep, hides nothing it can still analyze, and states both fill rates on every affected chart.
- An account ID of 00470 stays distinct from 470 through load, join, filter, and export.
- Loads four datasets covering transactions, opportunities, campaigns, and activities, with declared joins, and cross-filters across all four from one date range.
- Runs text extraction over a call-notes column, producing a locked taxonomy, sentiment over time, and themes that drill to verbatim rows.
- Given "chart win rate by stage by quarter for the enterprise segment," the AI emits a valid chart spec that renders, with no manual chart configuration.
- An answer containing a number not present in any tool result is visibly flagged as unverified.
- Every KPI opens "show the math" and shows filter, aggregation, and row count matching a manual recomputation.
- Exports a QBR PDF where every figure carries a citation and every section carries provenance.
- With the AI settings blank, everything except the AI panel still works.
- Opens from file:// with the network disabled. node .verify-core.js and node .verify-inline.js both pass.
- A 500,000 row file loads with a progress indicator and no frozen tab.


## Working instructions
Build in phase order. After each phase: update the headless tests, run them, and report what changed and what the phase does not yet cover. Do not proceed to the next phase with failing tests.

Where a design decision is genuinely ambiguous, such as fiscal year start, default probability weights by stage, or the sentiment scale, expose it as a setting with a sensible default rather than hard-coding a guess.

Prefer boring, inspectable implementations over clever ones. This tool's value is that its numbers can be trusted and its logic can be read.
