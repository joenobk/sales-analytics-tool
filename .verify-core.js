// Headless verification of SalesCore logic extracted from index.html
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const startMarker = html.indexOf("* SalesCore");
const endMarker = html.indexOf("</script>", startMarker);
if (startMarker === -1 || endMarker === -1) { console.error("FAIL: could not extract SalesCore script block"); process.exit(1); }
let src = html.slice(html.lastIndexOf("<script>", startMarker), endMarker).replace(/^<script>/, "");
// Stub localStorage so the Phase 1 mapping persistence code can run headless.
const lsStore = {};
const fakeLocalStorage = { getItem: k => (k in lsStore ? lsStore[k] : null), setItem: (k, v) => { lsStore[k] = String(v); }, removeItem: k => { delete lsStore[k]; } };
const mod = { exports: {} };
new Function("module", "window", "localStorage", src)(mod, {}, fakeLocalStorage);
const Core = mod.exports;

// Minimal CSV reader (file is simple comma-separated)
const csvText = fs.readFileSync(path.join(__dirname, "Historical_Data.csv"), "utf8").trim();
const lines = csvText.split(/\r?\n/);
const header = lines[0].split(",");
const dataRows = lines.slice(1).map(l => l.split(","));

// ---------------------------------------------------------------------------
// Phase 7: verification layer — fabricated numbers flagged, verified answers
// fully verified, resultIds on every tool result, definition registry.
// ---------------------------------------------------------------------------
const ex = Core.Verify.extractNumbers("total: 9,537.5 units [r1]; down 12% from 2017; 0.25");
if (ex.length !== 4 || ex[0].num !== 9537.5 || ex[1].num !== 12 || ex[2].num !== 2017 || ex[3].num !== 0.25) { console.error("FAIL 7.1: extractNumbers", JSON.stringify(ex)); process.exit(1); }
console.log("phase 7.1 extractNumbers: ok");

const vRes = [
  { tool: "query", args: { dimensions: ["month"] }, result: { resultId: "r1", rows: [{ month: "2017-03", units: 320 }], count: 1 } },
  { tool: "compare_periods", args: {}, result: { resultId: "r2", current: 320, prior: 300, deltaAbs: 20, deltaPct: 0.0667 } }
];
const vc = Core.Verify.checkClaims("March total was 320 units [r1], up 20 from 300 [r2]. We invented 9999.", vRes);
if (vc.total !== 4 || vc.verified.length !== 3 || vc.unverified.length !== 1 || vc.unverified[0].str !== "9999") { console.error("FAIL 7.2: checkClaims verified/unverified", JSON.stringify(vc)); process.exit(1); }
if (vc.citations.join(",") !== "r1,r2") { console.error("FAIL 7.2: citations", JSON.stringify(vc.citations)); process.exit(1); }
console.log("phase 7.2 checkClaims fully-verified + fabrication: ok");

const emptyRes = [{ tool: "query", args: {}, result: { resultId: "r1", rows: [], count: 0 } }];
const vc2 = Core.Verify.checkClaims("No rows existed, but I report 888 units.", emptyRes);
if (!vc2.hasEmptyResult || vc2.unverified.some(u => u.str !== "888")) { console.error("FAIL 7.3: empty-result fabrication flag", JSON.stringify(vc2)); process.exit(1); }
console.log("phase 7.3 empty-result honesty: ok");

const chips = Core.Verify.renderCitations("total 320 [r1], prior 300 [r2]");
if (!chips.includes('class="cite-chip"') || !chips.includes('data-rid="r1"') || !chips.includes(">r1<")) { console.error("FAIL 7.4: renderCitations", chips); process.exit(1); }
console.log("phase 7.4 renderCitations: ok");

// Every tool result carries a resultId (the model can cite any of them).
const ctxAll = { datasets: [{ id: "d1", name: "t", hasData: true, mapping: [{ name: "m", type: "text", role: "dimension", concept: "product", idx: 0 }], rowsArr: [] }] };
const t1 = Core.Tools.runTool("list_datasets", {}, ctxAll);
const t2 = Core.Tools.runTool("describe_schema", { datasetId: "d1" }, ctxAll);
const t3 = Core.Tools.runTool("query", { dimensions: ["m"], measures: [] , limit: 10}, ctxAll);
const t4 = Core.Tools.runTool("extract_text_insights", { field: "m" }, ctxAll);
if (!t1.resultId || !t2.resultId || !t3.resultId || !t4.resultId) { console.error("FAIL 7.5: resultId on every tool result", JSON.stringify({ t1, t2, t3, t4 })); process.exit(1); }
console.log("phase 7.5 resultId on every tool: ok");

const d1 = Core.Verify.getDefinition("totalUnits");
const d2 = Core.Verify.getDefinition("winRate");
if (!d1 || !/sum/i.test(d1.definition) || !d2 || !/won/.test(d2.definition)) { console.error("FAIL 7.6: definition registry", JSON.stringify({ d1, d2 })); process.exit(1); }
console.log("phase 7.6 definition registry: ok");

// ---------------------------------------------------------------------------
// Phase 8: text analytics — two-pass taxonomy, strict per-row schema, cache by
// text hash, derived columns, honest low-confidence/unclassified reporting.
// ---------------------------------------------------------------------------
const TA = Core.TextAnalytics;
const h1 = TA.textHash("Customer happy with pricing");
const h2 = TA.textHash("Complained about late delivery");
if (h1 !== h2 && h1.length === 8 && h1 === TA.textHash("Customer happy with pricing")) { console.log("phase 8.1 textHash: ok"); }
else { console.error("FAIL 8.1: textHash must be stable + distinct", h1, h2); process.exit(1); }

const taxReply = JSON.stringify({ categories: [
  { name: "Positive feedback", definition: "Praise or satisfaction.", examples: ["happy with", "great service"] },
  { name: "Complaint", definition: "A problem or issue.", examples: ["late delivery", "broken"] },
  { name: "Question", definition: "Asks for information.", examples: ["how do I", "can you"] }
] });
const parsedTax = TA.parseTaxonomy("Here you go:\n```json\n" + taxReply + "\n```");
if (parsedTax.error || parsedTax.taxonomy.categories.length !== 3 || parsedTax.taxonomy.categories[1].name !== "Complaint") { console.error("FAIL 8.2: parseTaxonomy", JSON.stringify(parsedTax)); process.exit(1); }
if (!TA.parseTaxonomy("no json here").error) { console.error("FAIL 8.2: parseTaxonomy must error on non-JSON"); process.exit(1); }
console.log("phase 8.2 parseTaxonomy: ok");

const texts = ["Customer happy with pricing", "Complained about late delivery"];
const prompt2 = TA.buildClassifyPrompt(parsedTax.taxonomy, texts);
if (!prompt2.includes("Complaint") || !prompt2.includes("sentiment") || !prompt2.includes("escalationFlag")) { console.error("FAIL 8.3: buildClassifyPrompt must carry the locked taxonomy + strict schema"); process.exit(1); }
const goodReply = JSON.stringify([
  { sentiment: 0.8, sentimentLabel: "positive", categories: ["Positive feedback"], keyPhrases: ["happy"], escalationFlag: false, confidence: 0.9 },
  { sentiment: -0.7, sentimentLabel: "negative", categories: ["Complaint"], keyPhrases: ["late"], escalationFlag: true, confidence: 0.8 }
]);
const pc = TA.parseClassification(goodReply, parsedTax.taxonomy);
if (pc.error || pc.rows.length !== 2 || pc.rows[1].escalationFlag !== true || pc.rows[0].sentiment !== 0.8) { console.error("FAIL 8.3: parseClassification valid rows", JSON.stringify(pc)); process.exit(1); }
const offTax = JSON.stringify([
  { sentiment: 0.1, sentimentLabel: "neutral", categories: ["NotARealCategory"], keyPhrases: [], escalationFlag: false, confidence: 0.5 }
]);
const pcBad = TA.parseClassification(offTax, parsedTax.taxonomy);
if (!pcBad.error || !/outside the taxonomy/.test(pcBad.error)) { console.error("FAIL 8.3: off-taxonomy category must be rejected", JSON.stringify(pcBad)); process.exit(1); }
const pcSchema = TA.parseClassification(JSON.stringify([{ sentiment: 2, sentimentLabel: "x", categories: [], keyPhrases: [], escalationFlag: false, confidence: 0.5 }]), parsedTax.taxonomy);
if (!pcSchema.error) { console.error("FAIL 8.3: sentiment out of range must be rejected"); process.exit(1); }
console.log("phase 8.3 strict classification + off-taxonomy rejection: ok");

// Cache by hash of the text + taxonomy signature; re-runs cost nothing; a changed taxonomy misses.
const sig = TA.taxonomySig(parsedTax.taxonomy);
const cls = { sentiment: 0.8, sentimentLabel: "positive", categories: ["Positive feedback"], keyPhrases: [], escalationFlag: false, confidence: 0.9 };
TA.cacheResult(texts[0], sig, cls);
const hit = TA.cachedResult(texts[0], sig);
if (!hit || hit.sentiment !== 0.8) { console.error("FAIL 8.4: cached result must come back", JSON.stringify(hit)); process.exit(1); }
const sig2 = TA.taxonomySig({ categories: [{ name: "Different", definition: "x", examples: [] }] });
if (TA.cachedResult(texts[0], sig2)) { console.error("FAIL 8.4: different taxonomy must invalidate the cache"); process.exit(1); }
console.log("phase 8.4 text cache (hash + taxonomy sig): ok");

// Derived columns: sentiment/theme become ordinary mapped columns on the dataset.
const tRows = [["2024-01-05", "happy with pricing"], ["2024-01-06", "late delivery"], ["2024-01-07", ""]];
const tMap = [{ name: "Date", type: "date", role: "time", idx: 0 }, { name: "Notes", type: "text", role: "text", idx: 1 }];
const classified = [
  { sentiment: 0.9, sentimentLabel: "positive", categories: ["Positive feedback"], keyPhrases: [], escalationFlag: false, confidence: 0.9 },
  { sentiment: -0.6, sentimentLabel: "negative", categories: ["Complaint"], keyPhrases: [], escalationFlag: true, confidence: 0.99 },
  null // unclassified row — must stay blank, not forced
];
const att = TA.attachDerivedColumns(tMap, tRows, 1, classified);
const names = att.mapping.map(c => c.name);
if (!names.includes("Notes·Sentiment") || !names.includes("Notes·Theme") || !names.includes("Notes·Escalation")) { console.error("FAIL 8.5: derived columns missing", JSON.stringify(names)); process.exit(1); }
const themeIdx = att.mapping.find(c => c.name === "Notes·Theme").idx;
const sentIdx = att.mapping.find(c => c.name === "Notes·Sentiment").idx;
const escIdx = att.mapping.find(c => c.name === "Notes·Escalation").idx;
const confIdx = att.mapping.find(c => c.name === "Notes·Confidence").idx;
if (tRows[0][themeIdx] !== "Positive feedback" || tRows[1][sentIdx] !== -0.6 || tRows[1][escIdx] !== "yes" || tRows[2][themeIdx] !== "" || tRows[2][sentIdx] !== null) { console.error("FAIL 8.5: derived values not written", JSON.stringify(tRows)); process.exit(1); }
// Chartable through the normal engine: "Theme"/"Sentiment" resolve and group.
const themeCol = Core.Charts.fieldColumn(att.mapping, "Theme");
const sentCol = Core.Charts.fieldColumn(att.mapping, "Sentiment");
if (!themeCol || !sentCol || Core.Metrics.columnIndex(att.mapping, "Sentiment") < 0) { console.error("FAIL 8.5: derived columns must resolve for charts", JSON.stringify({ themeCol, sentCol })); process.exit(1); }
const specByTheme = Core.Charts.buildSeries({ type: "bar", x: { field: "Theme" }, y: [{ field: "Sentiment", agg: "avg" }] }, tRows, att.mapping, {});
if (!specByTheme.labels.length || specByTheme.labels.indexOf("Positive feedback") === -1) { console.error("FAIL 8.5: buildSeries must group by the derived Theme", JSON.stringify(specByTheme.labels)); process.exit(1); }
console.log("phase 8.5 derived columns + chartable via normal engine: ok");

const taStats = TA.themeStats(tRows, themeIdx, escIdx, confIdx);
if (taStats.themes.find(t => t.name === "Positive feedback").count !== 1 || taStats.themes.find(t => t.name === "(unclassified)").count !== 1 || taStats.escalationCount !== 1 || taStats.lowConfidenceCount !== 0) { console.error("FAIL 8.6: themeStats", JSON.stringify(taStats)); process.exit(1); }
console.log("phase 8.6 themeStats + honest unclassified: ok");

// extract_text_insights is deterministic: helpful error without a pipeline; summary with one.
const dsNoPipe = { id: "d1", name: "t", mapping: tMap, rowsArr: tRows };
const rNoPipe = Core.Tools.runTool("extract_text_insights", { field: "Notes" }, { datasets: [dsNoPipe] });
if (!rNoPipe.note || !/UI/.test(rNoPipe.note)) { console.error("FAIL 8.7: extract_text_insights without pipeline", JSON.stringify(rNoPipe)); process.exit(1); }
const dsPipe = Object.assign({}, dsNoPipe, { mapping: att.mapping, textInsights: { locked: true, classified: true, colIdx: 1, themeIdx: themeIdx, escalationIdx: escIdx, confidenceIdx: confIdx, taxonomy: parsedTax.taxonomy } });
const rPipe = Core.Tools.runTool("extract_text_insights", { field: "Notes" }, { datasets: [dsPipe] });
if (!rPipe.resultId || !rPipe.taxonomy || rPipe.taxonomy.length !== 3 || !rPipe.themes || rPipe.themes.length !== 3 || rPipe.themes.find(t => t.name === "Complaint").count !== 1 || rPipe.themes.find(t => t.name === "(unclassified)").count !== 1) { console.error("FAIL 8.7: extract_text_insights summary", JSON.stringify(rPipe)); process.exit(1); }
console.log("phase 8.7 extract_text_insights deterministic: ok");
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 9: importance, hierarchy, and visual clarity — deterministic severity
// ---------------------------------------------------------------------------
const SEV = Core.Severity;
// Levels: positive, normal, watch, critical; the engine assigns, never the model.
const sPos = SEV.severityScore({ magnitudePct: 0.3, z: 1.5, concentration: 0.1, positiveIsGood: true });
if (sPos.level !== "positive") { console.error("FAIL 9.1: big good move must be positive", JSON.stringify(sPos)); process.exit(1); }
const sCrit = SEV.severityScore({ magnitudePct: -0.6, z: 3.1, concentration: 0.7, positiveIsGood: true });
if (sCrit.level !== "critical" || sCrit.score < 4) { console.error("FAIL 9.1: large bad move + z + concentration must be critical", JSON.stringify(sCrit)); process.exit(1); }
const sWatch = SEV.severityScore({ magnitudePct: -0.3, z: 1.2, concentration: 0.3, positiveIsGood: true });
if (sWatch.level !== "watch") { console.error("FAIL 9.1: moderate bad move must be watch", JSON.stringify(sWatch)); process.exit(1); }
const sNorm = SEV.severityScore({ magnitudePct: 0.01, z: 0.1, concentration: 0, positiveIsGood: true });
if (sNorm.level !== "normal") { console.error("FAIL 9.1: tiny move must be normal", JSON.stringify(sNorm)); process.exit(1); }
const sRisk = SEV.severityScore({ magnitudePct: -0.04, z: 0.3, concentration: 0.85, positiveIsGood: true });
if (sRisk.level !== "watch") { console.error("FAIL 9.1: concentration risk raises a small bad figure to watch", JSON.stringify(sRisk)); process.exit(1); }
// Determinism: same inputs -> same level/score every time.
const sAgain = SEV.severityScore({ magnitudePct: -0.6, z: 3.1, concentration: 0.7, positiveIsGood: true });
if (sAgain.score !== sCrit.score || sAgain.level !== sCrit.level) { console.error("FAIL 9.1: severity must be deterministic", JSON.stringify({ sCrit, sAgain })); process.exit(1); }
console.log("phase 9.1 severity levels + determinism: ok");

// z-score vs a trailing window: stable window -> low z; spike -> z>2 (anomaly).
const win = [100, 102, 98, 101, 99, 103, 97, 100, 101, 99, 102, 98, 100, 101, 99];
const zStable = SEV.zScore(100, win);
if (Math.abs(zStable) >= 1) { console.error("FAIL 9.2: stable value must have low z", zStable); process.exit(1); }
const zSpike = SEV.zScore(220, win);
if (zSpike <= 2) { console.error("FAIL 9.2: spike must be >2 sigma", zSpike); process.exit(1); }
console.log("phase 9.2 z-score vs trailing window: ok");

// Anomaly markers: points outside 2 sigma of a ROLLING window, annotated with index/value/z.
const anoSeries = [];
for (let i = 0; i < 40; i++) anoSeries.push({ t: "2024-01-" + String(i + 1).padStart(2, "0"), units: (i % 5 === 0 ? 100 : 10) });
const anoms = SEV.anomalies(anoSeries, 12);
if (!anoms.length || anoms.length !== 5) { console.error("FAIL 9.3: expected 5 anomaly markers (every 5th spike after the window)", JSON.stringify(anoms)); process.exit(1); }
if (anoms[0].value !== 100 || anoms[0].z <= 2 || anoms[0].label == null) { console.error("FAIL 9.3: anomaly must carry value+z+label", JSON.stringify(anoms[0])); process.exit(1); }
console.log("phase 9.3 anomalies (rolling 2σ): ok");

// Sparkline: ≤maxPoints, normalized 0..1, preserves shape.
const spark = SEV.sparkline([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50], 5);
if (spark.length > 5 || spark.length < 1) { console.error("FAIL 9.4: sparkline must downsample", JSON.stringify(spark)); process.exit(1); }
if (Math.min.apply(null, spark) < -0.001 || Math.max.apply(null, spark) > 1.001) { console.error("FAIL 9.4: sparkline must normalize 0..1", JSON.stringify(spark)); process.exit(1); }
if (spark[spark.length - 1] <= spark[0]) { console.error("FAIL 9.4: sparkline must preserve the rising shape", JSON.stringify(spark)); process.exit(1); }
console.log("phase 9.4 sparkline normalize+shape: ok");

// Confidence/sample-size: few rows low, many rows high; never looks like many.
if (SEV.confidenceLabel(3).label !== "low" || SEV.confidenceLabel(3).note.indexOf("cautiously") === -1) { console.error("FAIL 9.5: 3 rows must be low confidence", JSON.stringify(SEV.confidenceLabel(3))); process.exit(1); }
if (SEV.confidenceLabel(300).label !== "high") { console.error("FAIL 9.5: 300 rows must be high", JSON.stringify(SEV.confidenceLabel(300))); process.exit(1); }
console.log("phase 9.5 confidence/sample-size: ok");
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 10: QBR report builder — auto-draft with cited figures, quarter parse,
// deterministic ids, actions tied to figures.
// ---------------------------------------------------------------------------
const RB = Core.ReportBuilder;
// 10.1 Quarter parsing.
const q2 = RB.parseQuarter("2026-Q2");
if (!q2 || q2.year !== 2026 || q2.q !== 2) { console.error("FAIL 10.1: parseQuarter('2026-Q2')", JSON.stringify(q2)); process.exit(1); }
const qy = RB.parseQuarter("2025");
if (!qy || qy.year !== 2025 || qy.q !== null) { console.error("FAIL 10.1: parseQuarter('2025')", JSON.stringify(qy)); process.exit(1); }
if (RB.parseQuarter("bogus") !== null || RB.parseQuarter("2026-Q9") !== null) { console.error("FAIL 10.1: invalid quarters must be null"); process.exit(1); }
const qb = RB.quarterBounds(2026, 2);
if (new Date(qb.fromMs).getMonth() !== 3 || new Date(qb.toMs).getMonth() !== 5) { console.error("FAIL 10.1: Q2 bounds must be Apr-Jun", JSON.stringify(qb)); process.exit(1); }
console.log("phase 10.1 parseQuarter + quarterBounds: ok");

// 10.2 Auto-draft on a small transactions fixture.
const qbrRows = [
  ["2026-04-05", "P1", "DE", "5"], ["2026-04-12", "P2", "DE", "7"], ["2026-05-01", "P1", "FR", "4"],
  ["2026-05-20", "P3", "DE", "9"], ["2026-06-10", "P2", "FR", "6"], ["2026-06-28", "P1", "DE", "3"]
];
const qbrHeader = ["Date", "Product", "Country", "Amount"];
const qbrMapping = [
  { name: "Date", type: "date", role: "time", concept: "time", idx: 0, format: "iso" },
  { name: "Product", type: "categorical", role: "dimension", concept: "product", idx: 1 },
  { name: "Country", type: "categorical", role: "geo", concept: "geography", idx: 2 },
  { name: "Amount", type: "number", role: "measure", concept: "amount", idx: 3 }
];
const draft1 = RB.buildAutoDraft({
  stats: { series: [], total: 34, topProducts: [["P1", 12]], rowCount: 6 },
  mapping: qbrMapping, rowsArr: qbrRows, recName: "QBR fixture", recKind: "transactions",
  provenance: "Source: QBR fixture · rows 6", quarter: { year: 2026, q: 2 }
});
if (!draft1.sections || draft1.sections.length < 5) { console.error("FAIL 10.2: must produce >=5 sections", draft1.sections && draft1.sections.length); process.exit(1); }
const hl = draft1.sections.find(s => s.id === "s-headline");
if (!hl || hl.body.indexOf("34") === -1 || !hl.figures.length) { console.error("FAIL 10.2: headline must cite the Q2 total (34)", JSON.stringify(hl)); process.exit(1); }
if (!draft1.figures.length || !draft1.figures.every(f => f.id && f.label != null && f.value != null && f.source)) { console.error("FAIL 10.2: figures must carry id/label/value/source", JSON.stringify(draft1.figures.slice(0,2))); process.exit(1); }
if (!draft1.sections.every(s => s.provenance)) { console.error("FAIL 10.2: every section needs provenance"); process.exit(1); }
if (!draft1.sections.find(s => s.id === "s-actions")) { console.error("FAIL 10.2: actions section missing"); process.exit(1); }
console.log("phase 10.2 auto-draft sections + cited headline + provenance: ok");

// 10.3 Determinism: same inputs -> identical figure ids (r1..rn).
const draft2 = RB.buildAutoDraft({
  stats: { series: [], total: 34, topProducts: [["P1", 12]], rowCount: 6 },
  mapping: qbrMapping, rowsArr: qbrRows, recName: "QBR fixture", recKind: "transactions",
  provenance: "Source: QBR fixture · rows 6", quarter: { year: 2026, q: 2 }
});
const ids1 = draft1.figures.map(f => f.id).join(",");
const ids2 = draft2.figures.map(f => f.id).join(",");
if (ids1 !== ids2) { console.error("FAIL 10.3: auto-draft must be deterministic", ids1, ids2); process.exit(1); }
if (draft1.figures.some((f, i) => f.id !== "r" + (i + 1))) { console.error("FAIL 10.3: citations must be sequential r1..rn"); process.exit(1); }
console.log("phase 10.3 auto-draft determinism + sequential citations: ok");

// 10.4 Every recommended action is tied to an existing figure.
const acts = draft1.sections.find(s => s.id === "s-actions");
if (!acts || !acts.body) { console.error("FAIL 10.4: actions body", JSON.stringify(acts)); process.exit(1); }
const figIds = new Set(draft1.figures.map(f => f.id));
const cited = acts.body.match(/\[r\d+\]/g) || [];
if (!cited.length) { console.error("FAIL 10.4: actions must cite figures"); process.exit(1); }
for (const c of cited) if (!figIds.has(c.slice(1, -1))) { console.error("FAIL 10.4: action citation " + c + " must exist in figures"); process.exit(1); }
console.log("phase 10.4 actions tied to figures: ok");
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 11: AI-guided multi-file discovery & onboarding
// ---------------------------------------------------------------------------
const OB = Core.Onboarding;
// 11.1 Concept vocabulary binds the corpus entities (Contact, Lead, Sale, Sale-Line).
const cContact = OB.conceptFromHeaderWord("ContactID");
if (cContact !== "contact") { console.error("FAIL 11.1: ContactID must bind to contact", cContact); process.exit(1); }
const cLead = OB.conceptFromHeaderWord("LeadID");
if (cLead !== "lead") { console.error("FAIL 11.1: LeadID must bind to lead", cLead); process.exit(1); }
const cSale = OB.conceptFromHeaderWord("SalesID");
if (cSale !== "sale") { console.error("FAIL 11.1: SalesID must bind to sale", cSale); process.exit(1); }
const cLine = OB.conceptFromHeaderWord("LineID");
if (cLine !== "sale_line") { console.error("FAIL 11.1: LineID must bind to sale_line", cLine); process.exit(1); }
console.log("phase 11.1 corpus concept vocabulary: ok");

// 11.2 Pre-profile: compact, deterministic, NEVER full rows (headers + ≤5 samples only).
const profRows = [["C1", "Alice", "2024-01-05", "100"], ["C2", "Bob", "2024-02-10", "200"]];
const profMap = [
  { name: "ContactID", type: "identifier", role: "identifier", concept: "contact", idx: 0 }, 
  { name: "FullName", type: "text", role: "dimension", idx: 1 },
  { name: "CreatedDate", type: "date", role: "time", concept: "time", idx: 2, format: "iso" },
  { name: "Amount", type: "number", role: "measure", concept: "amount", idx: 3 }
];
const prof = OB.preProfile("Contacts.csv", ["ContactID", "FullName", "CreatedDate", "Amount"], profRows, profMap);
if (prof.name !== "Contacts.csv" || prof.rowCount !== 2 || prof.dateRange[0] !== "2024-01-05" || prof.dateRange[1] !== "2024-02-10") { console.error("FAIL 11.2: pre-profile basics", JSON.stringify(prof)); process.exit(1); }
const profJSON = JSON.stringify(prof);
if (profJSON.indexOf('"Alice"') === -1) { console.error("FAIL 11.2: profile must carry ≤5 sample values"); process.exit(1); }
if (profJSON.indexOf('"full-row"') !== -1) { console.error("FAIL 11.2: profile must not carry full rows"); process.exit(1); }
if (prof.columns[0].samples.length > 5 || prof.columns[0].distinct !== 2 || prof.columns[1].nulls !== 0) { console.error("FAIL 11.2: profile column stats", JSON.stringify(prof.columns)); process.exit(1); }
console.log("phase 11.2 deterministic pre-profile (headers + ≤5 samples, no rows): ok");

// 11.3 Multi-hop join graph: corpus chain resolves into connected paths.
const dsContacts = { id: "contacts", name: "Contacts", fields: ["ContactID", "FullName"], mapping: [{ name: "ContactID", type: "identifier", role: "identifier", concept: "contact", idx: 0 }, { name: "FullName", type: "text", role: "dimension", idx: 1 }], rowsArr: [["C1", "Alice"], ["C2", "Bob"]] };
const dsLeads = { id: "leads", name: "Leads", fields: ["LeadID", "ContactID", "LeadSource"], mapping: [{ name: "LeadID", type: "identifier", role: "identifier", concept: "lead", idx: 0 }, { name: "ContactID", type: "identifier", role: "identifier", concept: "contact", idx: 1 }, { name: "LeadSource", type: "categorical", role: "dimension", idx: 2 }], rowsArr: [["L1", "C1", "web"], ["L2", "C2", "referral"]] };
const dsSales = { id: "sales", name: "Sales", fields: ["SalesID", "ContactID", "Amount"], mapping: [{ name: "SalesID", type: "identifier", role: "identifier", concept: "sale", idx: 0 }, { name: "ContactID", type: "identifier", role: "identifier", concept: "contact", idx: 1 }, { name: "Amount", type: "number", role: "measure", concept: "amount", idx: 2 }], rowsArr: [["S1", "C1", "100"], ["S2", "C2", "200"]] };
const graph = OB.resolveJoinGraph([dsContacts, dsLeads, dsSales], [
  { from: "leads", fromCol: "ContactID", to: "contacts", toCol: "ContactID" },
  { from: "sales", fromCol: "ContactID", to: "contacts", toCol: "ContactID" }
]);
if (!graph.paths.length) { console.error("FAIL 11.3: no connected path", JSON.stringify(graph)); process.exit(1); }
const chain = graph.paths.find(p => p.nodes.indexOf("contacts") !== -1 && p.nodes.indexOf("sales") !== -1);
if (!chain) { console.error("FAIL 11.3: must include the contacts-leads-sales chain"); process.exit(1); }
if (graph.errors && graph.errors.length) { console.error("FAIL 11.3: unexpected errors", graph.errors); process.exit(1); }
// Concept-absent join is REJECTED with a specific error.
const badGraph = OB.resolveJoinGraph([dsContacts, dsLeads], [{ from: "contacts", fromCol: "FullName", to: "leads", toCol: "LeadID" }]);
if (!badGraph.errors.length) { console.error("FAIL 11.3: concept-absent join must be rejected", JSON.stringify(badGraph)); process.exit(1); }
console.log("phase 11.3 multi-hop join graph + absent-concept rejection: ok");

// 11.4 Multi-hop enrichment: revenue per contact via Sale->Contact (single hop here; harness adds 2-hop).
const enrichedPerContact = OB.multiHopEnrich(graph.paths.find(p => p.nodes.indexOf("contacts") !== -1 && p.nodes.indexOf("sales") !== -1).edges, [dsContacts, dsLeads, dsSales], { measureField: "Amount", groupConcept: "contact" });
// Sale rows join to contact: S1->C1 (100), S2->C2 (200) => C1:100, C2:200 (group by ContactID on Contacts).
const c1 = enrichedPerContact.find(e => e.key === "C1");
if (!c1 || c1.value !== 100) { console.error("FAIL 11.4: revenue per contact must be correct", JSON.stringify(enrichedPerContact)); process.exit(1); }
console.log("phase 11.4 multi-hop enrichment (revenue per contact): ok");

// 11.4b True two-hop: revenue per contact via SaleLine→Sale→Contact.
const dsLines = { id: "lines", name: "SalesLines", fields: ["LineID", "SalesID", "LinePrice"], mapping: [
  { name: "LineID", type: "identifier", role: "identifier", concept: "sale_line", idx: 0 },
  { name: "SalesID", type: "identifier", role: "identifier", concept: "sale", idx: 1 },
  { name: "LinePrice", type: "number", role: "measure", concept: "amount", idx: 2 }
], rowsArr: [["LN1", "S1", "40"], ["LN2", "S1", "60"], ["LN3", "S2", "75"], ["LN4", "S9", "999"]] }; // S9 has no sale -> must not contribute
const graph2 = OB.resolveJoinGraph([dsContacts, dsSales, dsLines], [
  { from: "lines", fromCol: "SalesID", to: "sales", toCol: "SalesID" },
  { from: "sales", fromCol: "ContactID", to: "contacts", toCol: "ContactID" }
]);
const chain2 = graph2.paths.find(p => p.nodes.indexOf("lines") !== -1 && p.nodes.indexOf("contacts") !== -1);
if (!chain2) { console.error("FAIL 11.4b: 2-hop chain not found", JSON.stringify(graph2.paths)); process.exit(1); }
const revPerContact2 = OB.multiHopEnrich(chain2.edges, [dsContacts, dsSales, dsLines], { measureField: "LinePrice", groupConcept: "contact" });
// LN1+LN2 -> S1 -> C1 = 100; LN3 -> S2 -> C2 = 75; LN4 -> S9 (no sale) dropped.
const c1b = revPerContact2.find(e => e.key === "C1");
const c2b = revPerContact2.find(e => e.key === "C2");
if (!c1b || c1b.value !== 100 || !c2b || c2b.value !== 75) { console.error("FAIL 11.4b: 2-hop revenue per contact", JSON.stringify(revPerContact2)); process.exit(1); }
if (revPerContact2.some(e => e.value === 999)) { console.error("FAIL 11.4b: orphan line must not contribute"); process.exit(1); }
console.log("phase 11.4b true two-hop enrichment (SaleLine→Sale→Contact): ok");

// 11.5 Blueprint validation: bad role + absent concept rejected; bounded corpus summary.
const bpGood = OB.validateBlueprint({ datasets: [{ name: "Contacts", roleChanges: [{ column: "FullName", role: "text", concept: "contact" }] }], joins: [{ from: "Contacts", to: "Leads", on: "ContactID" }] }, []);
if (!bpGood.ok) { console.error("FAIL 11.5: valid blueprint rejected", bpGood.errors); process.exit(1); }
const bpBadRole = OB.validateBlueprint({ datasets: [{ name: "Contacts", roleChanges: [{ column: "FullName", role: "notarole" }] }] }, []);
if (bpBadRole.ok || !/role set/.test(bpBadRole.errors.join(" "))) { console.error("FAIL 11.5: bad role must be rejected", bpBadRole.errors); process.exit(1); }
const bpBadConcept = OB.validateBlueprint({ datasets: [{ name: "Contacts", roleChanges: [{ column: "X", concept: "ufo" }] }] }, []);
if (bpBadConcept.ok || !/registry/.test(bpBadConcept.errors.join(" "))) { console.error("FAIL 11.5: absent concept must be rejected", bpBadConcept.errors); process.exit(1); }
const summary = OB.corpusSummary([{ name: "Contacts.csv", rowCount: 2, dateRange: ["2024-01-05", "2024-02-10"], columns: [{ name: "ContactID", type: "identifier", role: "identifier", concept: "contact", distinct: 2, nulls: 0, samples: ["C1", "C2"] }] }]);
if (summary.indexOf("Contacts.csv") === -1 || summary.indexOf("ContactID") === -1) { console.error("FAIL 11.5: corpus summary", summary); process.exit(1); }
console.log("phase 11.5 blueprint validation + bounded corpus summary: ok");

// 11.6 Persist review keyed by sorted file-shape hash.
const shapeKey = OB.shapesKey([{ name: "Contacts.csv", fields: ["ContactID", "FullName"] }, { name: "Leads.csv", fields: ["LeadID", "ContactID"] }]);
const shapeKey2 = OB.shapesKey([{ name: "Leads.csv", fields: ["LeadID", "ContactID"] }, { name: "Contacts.csv", fields: ["ContactID", "FullName"] }]);
if (shapeKey !== shapeKey2) { console.error("FAIL 11.6: shapesKey must be order-independent", shapeKey, shapeKey2); process.exit(1); }
OB.saveReview({ key: shapeKey, decisions: {} }, fakeLocalStorage);
const loaded = OB.loadReview(fakeLocalStorage);
if (!loaded || loaded.key !== shapeKey) { console.error("FAIL 11.6: review persist round-trip", JSON.stringify(loaded)); process.exit(1); }
console.log("phase 11.6 review persistence by shape hash: ok");
// ---------------------------------------------------------------------------

// 1. Parse + validate
const parsed = Core.parseCsvData(header, dataRows);
console.log("rows:", parsed.rows.length, "errors:", JSON.stringify(parsed.errors));
if (parsed.rows.length !== 4849) { console.error("FAIL: expected 4849 rows"); process.exit(1); }

// 2. Date parsing spot-checks
const r0 = parsed.rows[0];
console.log("first row:", r0.date.toISOString().slice(0,10), r0.articleId, r0.countryCode, r0.units);
if (r0.date.getFullYear() !== 2017 || r0.date.getMonth() !== 7 || r0.date.getDate() !== 17) { console.error("FAIL: date parse"); process.exit(1); }

// 3. Aggregation consistency: day/week/month totals must equal grand total
const total = parsed.rows.reduce((s, r) => s + r.units, 0);
for (const mode of ["day", "week", "month"]) {
  const agg = Core.aggregate(parsed.rows, mode);
  const sum = agg.reduce((s, b) => s + b.units, 0);
  if (sum !== total) { console.error(`FAIL: ${mode} aggregation sum ${sum} != total ${total}`); process.exit(1); }
  // sorted ascending by t?
  for (let i = 1; i < agg.length; i++) if (agg[i].t <= agg[i-1].t) { console.error(`FAIL: ${mode} not time-sorted`); process.exit(1); }
  console.log(`${mode}: buckets=${agg.length}, sum=${sum}`);
}

// 4. Stats + KPIs
const stats = Core.computeStats(parsed.rows, "month");
console.log("total:", stats.total, "| top:", JSON.stringify(stats.topProducts[0]), "| bottom:", JSON.stringify(stats.bottomProduct));
console.log("byCountry:", JSON.stringify(stats.byCountry.map(c => c[0] + ":" + c[1])));
console.log("trend slope/month:", stats.slopePerBucket.toFixed(2), "seasonPeak:", stats.seasonPeak.name, (stats.seasonPeak.deviationPct*100).toFixed(1) + "%");

// 5. Filtered view: single product + country
const filtered = parsed.rows.filter(r => r.articleId === stats.topProducts[0][0] && r.countryCode === "SE");
const fstats = Core.computeStats(filtered, "day");
console.log("filtered (top prod, SE): rows=" + fstats.rowCount, "total=" + fstats.total);
if (!fstats.rowCount) { console.error("FAIL: filtered view unexpectedly empty"); process.exit(1); }

// 6. AI prompt + fallback render without throwing
const p = Core.buildAiPrompt(stats, "month");
if (!p.includes("Total units sold:")) { console.error("FAIL: ai prompt missing total"); process.exit(1); }
const fb = Core.buildStatisticalFallback(stats);
console.log("--- fallback preview ---\n" + fb.split("\n").slice(0, 4).join("\n"));

// 7. Bad CSV handling
const badParsed = Core.parseCsvData(["Date", "Article_ID"], [["20170817","x"]]);
if (!badParsed.errors.length) { console.error("FAIL: missing-column error not raised"); process.exit(1); }
console.log("missing-col error:", badParsed.errors[0]);

// 8. Invalid date row skipped
const badDate = Core.parseCsvData(header, [["99999999","1","AT","5"],["20170817","1","AT","3"]]);
if (badDate.rows.length !== 1 || !/skipped/i.test(badDate.errors[0])) { console.error("FAIL: invalid date handling"); process.exit(1); }

// 9. Phase 0: all named modules present on the namespace (eleven after Phases 2-3)
for (const modName of ["Schema", "Datasets", "Entities", "Joins", "Store", "Metrics", "Charts", "Insight", "Text", "Report", "AI", "Tools", "Verify"]) {
  if (!Core[modName] || typeof Core[modName] !== "object") { console.error(`FAIL: module ${modName} missing on SalesCore`); process.exit(1); }
}
console.log("modules present:", ["Schema","Datasets","Entities","Joins","Store","Metrics","Charts","Insight","Text","Report","AI","Tools","Verify"].join(", "));

// 10. Phase 0: HTML sanitizer strips script/style tags, on* attrs, javascript: URLs
const dirty = '<script>alert(1)</script><div onclick="x()" style="color:red">ok</div><a href="javascript:void(0)">j</a><style>p{}</style>';
const clean = Core.Text.sanitizeHtml(dirty);
if (/<script/i.test(clean) || /<style/i.test(clean) || /onclick/i.test(clean) || /javascript:/i.test(clean)) { console.error("FAIL: sanitizer leaked dangerous markup:", clean); process.exit(1); }
console.log("sanitizer output:", JSON.stringify(clean));

// 11. Phase 0: escapeHtml escapes the five special characters
const esc = Core.Text.escapeHtml('<a href="x">&\'</a>');
if (esc !== "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;") { console.error("FAIL: escapeHtml wrong:", esc); process.exit(1); }

// 12. Phase 0: observable store get/set/subscribe
const st = Core.Store.create({ a: 1 });
let notified = null;
st.subscribe(v => { notified = v; });
st.set("a", 2);
if (st.get("a") !== 2 || notified.a !== 2) { console.error("FAIL: store get/set/subscribe"); process.exit(1); }

// 13. Phase 0: CSV builder emits the fixed header and sorts rows by date/article/country
const mkRow = (d, a, c, u) => ({ date: new Date(d), articleId: a, countryCode: c, units: u });
const csvRows = [mkRow("2017-08-18","9","SE",2), mkRow("2017-08-17","3448","AT",5)];
const csvOut = Core.Report.buildCsvString(csvRows);
if (!csvOut.startsWith("Date,Article_ID,Country_Code,Sold_Units\n")) { console.error("FAIL: buildCsvString header:", JSON.stringify(csvOut)); process.exit(1); }
const csvLines = csvOut.split("\n");
if (csvLines[1] !== "2017-08-17,3448,AT,5" || csvLines[2] !== "2017-08-18,9,SE,2") { console.error("FAIL: buildCsvString sort/content:", JSON.stringify(csvOut)); process.exit(1); }
if (Core.Report.buildCsvString([]) !== "") { console.error("FAIL: buildCsvString empty"); process.exit(1); }

// 14. Phase 0: AI context key is stable for identical inputs, changes when any input changes
const k1 = Core.AI.filterKey(["P1"], ["SE"], "month", 1700000000000, 1800000000000);
const k2 = Core.AI.filterKey(["P1"], ["SE"], "month", 1700000000000, 1800000000000);
const k3 = Core.AI.filterKey(["P1"], ["FR"], "month", 1700000000000, 1800000000000);
if (k1 !== k2 || k1 === k3) { console.error("FAIL: AI filterKey stability"); process.exit(1); }

// 15. Phase 0: Charts.buildLineSpec returns a Chart.js-ready spec with regression + moving average
const series = [{ label: "a", units: 1 }, { label: "b", units: 3 }, { label: "c", units: 2 }, { label: "d", units: 6 }];
const spec = Core.Charts.buildLineSpec(series, { regression: true, movingAvg: true, maWindow: 2 });
if (!Array.isArray(spec.labels) || spec.labels.length !== 4) { console.error("FAIL: buildLineSpec labels"); process.exit(1); }
if (spec.datasets.length < 3) { console.error("FAIL: buildLineSpec datasets:", spec.datasets.length); process.exit(1); }
const base = Core.Charts.buildLineSpec(series, {});
if (base.datasets.length !== 1) { console.error("FAIL: buildLineSpec default should be single dataset"); process.exit(1); }

// 16. Phase 1: every supported date format parses correctly
const fmtChecks = [
  ["yyyymmdd", "20170817", [2017, 8, 17]],
  ["iso", "2017-08-17T13:45:00", [2017, 8, 17]],
  ["mdy", "08/17/2017", [2017, 8, 17]],
  ["dmy", "17.08.2017", [2017, 8, 17]],
  ["monyear", "Aug 2017", [2017, 8, 1]],
  ["quarter", "2026-Q4", [2026, 10, 1]],
  ["excel", "42964", [2017, 8, 17]] // Excel serial for 2017-08-17 (epoch 1899-12-30)
];
for (const [fmt, val, [y, m, d]] of fmtChecks) {
  const dt = Core.parseDateByFormat(val, fmt);
  if (!dt || dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) { console.error(`FAIL: date format ${fmt} on "${val}"`); process.exit(1); }
}
// Invalid dates must not parse (e.g. Feb 30, month out of range)
if (Core.parseDateByFormat("2017-02-30", "iso") || Core.parseDateByFormat("13/45/2017", "mdy")) { console.error("FAIL: invalid dates must not parse"); process.exit(1); }

// 17. Phase 1: ID-shaped integer column is NOT classified as measure
const idCol = Core.inferColumn("Article_ID", Array.from({ length: 200 }, (_, i) => String(3400 + i)));
if (idCol.type !== "number" || idCol.role === "measure") { console.error(`FAIL: Article_ID classified as ${idCol.type}/${idCol.role}`); process.exit(1); }
const unitsCol = Core.inferColumn("Sold_Units", ["3", "7", "0", "12", "5"]);
if (unitsCol.type !== "number" || unitsCol.role !== "measure") { console.error(`FAIL: Sold_Units classified as ${unitsCol.type}/${unitsCol.role}`); process.exit(1); }

// 18. Phase 1: currency string column parses to numbers
const curChecks = [["$1,234.50", 1234.5], ["€999", 999], ["(1,000)", -1000], ["12%", 12]];
for (const [s, n] of curChecks) { const v = Core.parseNumberValue(s); if (v !== n) { console.error(`FAIL: parseNumberValue("${s}") = ${v}, expected ${n}`); process.exit(1); } }
if (Core.parseNumberValue("abc") !== null || Core.parseNumberValue("") !== null) { console.error("FAIL: non-numeric must stay null"); process.exit(1); }

// 19. Phase 1: full inference on the real header shape + mapping round-trip through localStorage
const inferred = Core.inferMapping(header, dataRows);
const byName = Object.fromEntries(inferred.map(c => [c.name, c]));
if (byName.Date.type !== "date" || byName.Date.role !== "time") { console.error("FAIL: Date inference", JSON.stringify(byName.Date)); process.exit(1); }
if (byName.Article_ID.role === "measure") { console.error("FAIL: Article_ID must not be a measure"); process.exit(1); }
if (byName.Sold_Units.type !== "number" || byName.Sold_Units.role !== "measure") { console.error("FAIL: Sold_Units inference", JSON.stringify(byName.Sold_Units)); process.exit(1); }
console.log("inferred:", inferred.map(c => `${c.name}:${c.type}/${c.role}${c.format ? "(" + c.format + ")" : ""}`).join(", "));

// Round-trip: save the confirmed mapping to localStorage, reload it, parse with it — must match legacy parse.
const key = Core.mappingKey(header);
lsStore["salesMapping:" + key] = JSON.stringify(inferred.map(c => ({ name: c.name, type: c.type, role: c.role, format: c.format })));
const reloaded = JSON.parse(fakeLocalStorage.getItem("salesMapping:" + key));
if (!reloaded || reloaded.length !== header.length) { console.error("FAIL: mapping round-trip through localStorage"); process.exit(1); }
const mappedParsed = Core.parseWithMapping(header, dataRows, reloaded);
if (mappedParsed.rows.length !== parsed.rows.length) { console.error(`FAIL: parseWithMapping rows ${mappedParsed.rows.length} != legacy ${parsed.rows.length}`); process.exit(1); }
const mTotal = mappedParsed.rows.reduce((s, r) => s + r.units, 0);
if (mTotal !== total) { console.error("FAIL: parseWithMapping total mismatch"); process.exit(1); }

// mappingKey is order-insensitive and stable
if (Core.mappingKey(header) !== Core.mappingKey([...header].reverse())) { console.error("FAIL: mappingKey must be order-insensitive"); process.exit(1); }
if (Core.mappingKey(header) === Core.mappingKey(["Date", "Article_ID", "Country_Code", "Sold_Units", "Extra"])) { console.error("FAIL: mappingKey must differ for different shapes"); process.exit(1); }

// parseWithMapping with a broken mapping reports errors instead of silently loading
const bad = Core.parseWithMapping(header, dataRows, inferred.map(c => ({ ...c, role: c.role === "time" ? "ignore" : c.role })));
if (bad.rows.length || !bad.errors.length) { console.error("FAIL: missing time column must produce errors"); process.exit(1); }

// ---- Phase 2: entity/concept resolution (PRD test additions) ----

// ID+name binds one entity; group by ID, display name.
const entHeader = ["Date", "Article_ID", "Article_Name", "Country_Code", "Sold_Units"];
const entRows = [
  ["2024-01-02", "A-1", "Widget", "DE", "5"],
  ["2024-02-03", "A-1", "Widget", "FR", "3"],
  ["2024-03-04", "A-2", "Gadget", "DE", "7"]
];
const entInferred = Core.inferMapping(entHeader, entRows).map((c, i) => Object.assign({}, c, { idx: i })); // pairIdLabel/buildEntityRegistry address raw rows by header index
const entParsed = Core.parseWithMapping(entHeader, entRows, entInferred.map(c => ({ name: c.name, type: c.type, role: c.role })));
// raw rows with column indices for the Entities module (idKey-based)
const idx = {}; entHeader.forEach((h, i) => idx[h] = i);
const rawEntRows = entRows.map(r => r.map(v => v));
const pairs = Core.Entities.pairIdLabel(entInferred, rawEntRows);
if (!pairs.length || !pairs.some(p => p.idCol === "Article_ID" && p.labelCol === "Article_Name")) { console.error("FAIL: ID/label pair not detected:", JSON.stringify(pairs)); process.exit(1); }
const registry = Core.Entities.buildEntityRegistry(rawEntRows, entInferred, pairs);
if (!registry.product || !registry.product.entries["A-1"] || registry.product.entries["A-1"].label !== "Widget") { console.error("FAIL: entity registry did not bind ID+name"); process.exit(1); }
const disp = Core.Entities.entityDisplay(registry, "product", "A-1");
if (disp !== "Widget") { console.error("FAIL: entity display should show the label, got:", disp); process.exit(1); }

// Leading zeros survive load and join.
const zeroRows = [
  ["2024-01-02", "00123", "ZeroPad", "DE", "1"],
  ["2024-02-03", "123", "Other", "DE", "2"],
  ["2024-03-04", "00123", "ZeroPad", "FR", "3"],
  ["2024-04-05", "123", "Other", "SE", "4"]
];
const zeroParsed = Core.parseWithMapping(entHeader, zeroRows, entInferred.map(c => ({ name: c.name, type: c.type, role: c.role })));
if (zeroParsed.rows.length !== zeroRows.length) { console.error("FAIL: leading-zero rows must load:", JSON.stringify(zeroParsed.errors)); process.exit(1); }
const zrIdx = {}; entHeader.forEach((h, i) => zrIdx[h] = i);
const zrReg = Core.Entities.buildEntityRegistry(zeroRows.map(r => r), entInferred, [{ idCol: "Article_ID", labelCol: "Article_Name", concept: "product" }]);
if (!zrReg.product.entries["00123"] || !zrReg.product.entries["123"]) { console.error("FAIL: 00123 and 123 must be DISTINCT entities (leading zeros preserved)"); process.exit(1); }

// One ID, two names -> conflict surfaced with row counts; resolved by explicit rule, never silent.
const confRows = [["01/02/2024", "X-9", "Old Name", "DE", "1"], ["02/02/2024", "X-9", "New Name", "FR", "2"], ["03/02/2024", "X-9", "New Name", "DE", "3"]];
const confReg = Core.Entities.buildEntityRegistry(confRows, entInferred, [{ idCol: "Article_ID", labelCol: "Article_Name", concept: "product" }]);
if (!confReg.product.conflicts.length) { console.error("FAIL: one ID with two names must raise a conflict"); process.exit(1); }
const conf = confReg.product.conflicts[0];
if (conf.labels.length !== 2 || !conf.labels.every(l => l.rows > 0)) { console.error("FAIL: conflict must carry competing labels with row counts:", JSON.stringify(conf)); process.exit(1); }
Core.Entities.resolveConflict(confReg, "product", "most-frequent");
if (conf.chosen !== "New Name" || conf.resolvedBy !== "most-frequent") { console.error("FAIL: most-frequent resolution must pick the label with more rows:", JSON.stringify(conf)); process.exit(1); }

// most-recent rule picks the last-seen label even when it is less frequent.
const recRows = [["01/02/2024", "Z-1", "Older", "DE", "1"], ["02/02/2024", "Z-1", "Older", "FR", "2"], ["03/02/2024", "Z-1", "Newest", "DE", "3"]];
const recReg = Core.Entities.buildEntityRegistry(recRows, entInferred, [{ idCol: "Article_ID", labelCol: "Article_Name", concept: "product" }]);
Core.Entities.resolveConflict(recReg, "product", "most-recent");
if (recReg.product.conflicts[0].chosen !== "Newest") { console.error("FAIL: most-recent must pick the last-seen label:", JSON.stringify(recReg.product.conflicts[0])); process.exit(1); }

// Weak fuzzy match -> review queue, not auto-merge. Strong + persisted alias auto-applies to a second file.
const fm = Core.Entities.fuzzyMatch(["Acme GmbH", "Beta Industries"], ["Acme Gmbh", "Beta Industrial Co"]);
if (fm.queue.length !== 1 || !fm.queue[0].a.includes("Beta")) { console.error("FAIL: uncertain band must go to the review queue:", JSON.stringify(fm)); process.exit(1); }
Core.Entities.confirmFuzzy("Beta Industries", "Beta Industrial Co");
const fm2 = Core.Entities.fuzzyMatch(["Beta Industries"], ["Beta Industrial Co"]);
if (!fm2.accepted.length || fm2.accepted[0].how !== "persisted") { console.error("FAIL: confirmed alias must persist and apply to the second file:", JSON.stringify(fm2)); process.exit(1); }

// Absent concept -> coverage reports it; schema payload names missing concepts.
const cov = Core.Entities.coverage(rawEntRows, Core.Entities.bindConcepts(entInferred));
if (cov.product.present !== true || cov.rep.present !== false) { console.error("FAIL: coverage must mark present/absent concepts:", JSON.stringify(cov)); process.exit(1); }
const aiDesc = Core.Entities.schemaDescriptionForAi(cov);
if (!aiDesc.includes("rep: ABSENT") || !aiDesc.toLowerCase().includes("cannot be computed")) { console.error("FAIL: schema payload must name missing concepts and forbid estimating them:", aiDesc); process.exit(1); }

// Learned concept override persists and applies to a second file.
Core.Entities.recordOverride("Cust_Ref", "account");
const secondFile = Core.Entities.bindConcepts([{ name: "Cust_Ref", type: "text", role: "dimension" }]);
if (secondFile[0].concept !== "account") { console.error("FAIL: recorded override must apply to future files:", JSON.stringify(secondFile)); process.exit(1); }

// Hierarchy detection: child column rolls up into parent when every occurrence coincides with a single value.
const hierRows = [["DE", "Berlin"], ["DE", "Hamburg"], ["FR", "Lyon"]]; // col0=country, col1=city
const hierCols = [{ name: "Country", type: "text", role: "geo", idx: 0 }, { name: "City", type: "text", role: "dimension", idx: 1 }];
const hier = Core.Entities.detectHierarchy(hierRows, hierCols);
if (!hier.some(h => h.child === "City" && h.parent === "Country")) { console.error("FAIL: City->Country hierarchy not detected:", JSON.stringify(hier)); process.exit(1); }

// Geography: country name -> code keeping original; unknown country never guessed.
const cn = Core.Entities.normalizeCountry("Germany");
if (cn.code !== "DE" || cn.original !== "Germany") { console.error("FAIL: Germany must normalize to DE keeping the original:", JSON.stringify(cn)); process.exit(1); }
const cn2 = Core.Entities.normalizeCountry("Republik of Nowhere");
if (cn2.code !== null) { console.error("FAIL: unknown country must not be guessed:", JSON.stringify(cn2)); process.exit(1); }

// Address extraction: confident parts only; postal-only address = finest level is postal.
const addr = Core.Entities.extractAddress("Main Street 5, 80331 Munich, Germany");
if (addr.postal !== "80331" || addr.country !== "DE") { console.error("FAIL: address extraction must pull postal + country:", JSON.stringify(addr)); process.exit(1); }
const addr2 = Core.Entities.extractAddress("94123"); // postal-only
if (!addr2.postal) { console.error("FAIL: bare postal code not recognized:", JSON.stringify(addr2)); process.exit(1); }
if (Core.Entities.geoLevel(addr2) !== "postal") { console.error("FAIL: postal-only address must have finest level 'postal'"); process.exit(1); }

// AI prompt carries the coverage section: absent concepts named, model told not to speculate.
const p2 = Core.buildAiPrompt(stats, "month", entInferred, rawEntRows);
if (!p2.includes("DATA COVERAGE") || !/ABSENT/.test(p2)) { console.error("FAIL: AI prompt must include coverage section naming absent concepts:\n" + p2); process.exit(1); }
const p3 = Core.buildAiPrompt(stats, "month"); // no mapping -> no coverage section, still valid
if (p3.includes("DATA COVERAGE")) { console.error("FAIL: AI prompt without a loaded file must not claim coverage"); process.exit(1); }

// ---- Phase 3: Datasets registry + Joins (concept-based left joins) ----

// Synthetic dataset A: transactions. Dataset B: campaigns keyed by product code.
const aFields = ["Date", "Article_ID", "Country_Code", "Units"];
const aRowsArr = [
  ["2017-08-17", "A1", "AT", "5"],
  ["2017-08-18", "A1", "DE", "3"],
  ["2017-08-19", "B2", "AT", "7"]
];
const bFields = ["Product_Code", "Campaign_Name", "Spend"];
const bRowsArr = [
  ["A1", "Summer Promo", "120"],
  ["A1", "Q3 Push", "45"],
  ["C3", "Winter Sale", "99"]
];

// App-layer mapping shape: array of column objects with resolved idx + role (from inference) + concept.
function mkMap(fields, concepts, roles) {
  return fields.map((name, i) => ({ name: name, idx: i, role: roles ? roles[i] : null, type: "text", concept: concepts[i] || null }));
}
const aMap = mkMap(aFields, ["time", "product", "geography", "amount"], ["time", "identifier", "geo", "measure"]);
const bMap = mkMap(bFields, ["product", null, "amount"], ["identifier", "dimension", "measure"]);

// Datasets registry round-trip (metadata only).
const recA = Core.Datasets.add({ name: "Sales 2017", sourceFile: "sales.csv", rowCount: aRowsArr.length, schema: aFields });
if (!recA.id || recA.kind !== "generic" || recA.hasData !== true) { console.error("FAIL: Datasets.add must set id/kind/hasData:", JSON.stringify(recA)); process.exit(1); }
const recB = Core.Datasets.add({ name: "Campaigns", sourceFile: "campaigns.xlsx", rowCount: bRowsArr.length, schema: bFields, kind: "campaigns" });
if (recB.kind !== "campaigns") { console.error("FAIL: Datasets.add must keep a valid explicit kind"); process.exit(1); }
Core.Datasets.saveMeta([recA, recB]);
const meta = Core.Datasets.loadMeta();
if (meta.length !== 2 || meta[0].id !== recA.id || meta[1].kind !== "campaigns") { console.error("FAIL: Datasets saveMeta/loadMeta round-trip:", JSON.stringify(meta)); process.exit(1); }
console.log("datasets registry:", meta.map(m => m.name + "(" + m.kind + ")").join(", "), "| rows persisted in metadata only");

// Joins.buildIndex on B's product column (concept-addressed).
const bIdx = Core.Joins.buildIndex(bRowsArr, bMap, "product");
if (!bIdx || !bIdx.index["A1"] || bIdx.index["A1"].length !== 2) { console.error("FAIL: buildIndex must hash A1 -> both rows:", JSON.stringify(bIdx)); process.exit(1); }

// Joins.evaluate: A has 3 rows, only A1 matches (2 of 3).
const stat = Core.Joins.evaluate(aRowsArr, aMap, bIdx, { fromConcept: "product", toConcept: "product" });
if (!stat || stat.matchedRows !== 2 || stat.rows !== 3) { console.error("FAIL: evaluate stats wrong:", JSON.stringify(stat)); process.exit(1); }

// Joins.enrichColumn: sum Spend per product; unmatched B2 -> null.
const enriched = Core.Joins.enrichColumn(aRowsArr, aMap, bIdx, bRowsArr, bMap, { fromConcept: "product", toConcept: "product" }, "amount");
if (!enriched || enriched[0] !== 165 || enriched[1] !== 165 || enriched[2] !== null) { console.error("FAIL: enrichColumn must sum one-to-many and null unmatched:", JSON.stringify(enriched)); process.exit(1); }

// Joins.propose: A↔B share the product concept at a high match rate; no collision with unrelated datasets.
recA.mapping = aMap; recB.mapping = bMap; // app layer stores the resolved mapping on each record
const proposals = Core.Joins.propose(recA, aRowsArr, recB, bRowsArr);
if (!proposals.length || proposals[0].fromConcept !== "product" || proposals[0].matchRate < 0.5) { console.error("FAIL: propose must surface the product join:", JSON.stringify(proposals)); process.exit(1); }
const cFields = ["Call_ID", "Rep_Name"];
const cRowsArr = [["c1", "Ann"], ["c2", "Bob"]];
const cMap = mkMap(cFields, [null, "rep"]);
const recC = Core.Datasets.add({ name: "Calls", sourceFile: "calls.csv", rowCount: 2, schema: cFields });
recC.mapping = cMap;
const noProposals = Core.Joins.propose(recA, aRowsArr, recC, cRowsArr);
if (noProposals.length !== 0) { console.error("FAIL: datasets sharing no concepts must yield no proposals:", JSON.stringify(noProposals)); process.exit(1); }

// Concept lookup helpers used by the filter bus.
if (Core.Entities.columnForConcept(aMap, "product") !== "Article_ID" || Core.Entities.columnForConcept(bMap, "geography") !== null) { console.error("FAIL: columnForConcept lookups wrong"); process.exit(1); }

// Schema.parseGeneric: lenient parse — no rows dropped, missing roles -> null + warnings.
const gB = Core.parseGeneric(bFields, bRowsArr, mkMap(bFields, ["product", null, "amount"], ["identifier", "dimension", "measure"]));
if (!gB || gB.rows.length !== 3) { console.error("FAIL: parseGeneric must keep every row:", JSON.stringify(gB && gB.rows)); process.exit(1); }
if (gB.rows[0].articleId !== "A1" || gB.rows[0].units !== 120 || gB.rows[0].date !== null) { console.error("FAIL: parseGeneric field mapping wrong:", JSON.stringify(gB.rows[0])); process.exit(1); }
if (!gB.warnings.length || !/time/i.test(gB.warnings.join(" "))) { console.error("FAIL: parseGeneric must warn about the missing time column:", JSON.stringify(gB.warnings)); process.exit(1); }
const gA = Core.parseGeneric(aFields, [["2017-08-17", "", "AT", ""], ["2017-08-18", "A1", null, "3"]], mkMap(aFields, ["time", "product", "geography", "amount"], ["time", "identifier", "geo", "measure"]));
if (gA.rows.length !== 2 || gA.rows[0].articleId !== null || gA.rows[0].units !== null || gA.rows[1].countryCode !== null) { console.error("FAIL: parseGeneric must map missing values to null without dropping rows:", JSON.stringify(gA.rows)); process.exit(1); }
if (gA.warnings.length !== 0) { console.error("FAIL: parseGeneric with all roles present must not warn:", JSON.stringify(gA.warnings)); process.exit(1); }

// Phase 3: a persisted time format from another source must not be trusted blindly — the
// format is resolved from the ACTUAL data (xlsx/dash-style dates against a yyyymmdd mapping).
const wrongFmt = Core.parseGeneric(
  ["Date", "Article_ID", "Country_Code", "Sold_Units"],
  [["2017-09-01", "332", "SE", "2"], ["2017-09-02", "332", "DK", "3"]],
  mkMap(["Date", "Article_ID", "Country_Code", "Sold_Units"], ["time", "product", "geography", "amount"], ["time", "identifier", "geo", "measure"]).map(function (c) { return c.name === "Date" ? Object.assign({}, c, { format: "yyyymmdd" }) : c; })
);
if (!wrongFmt.rows.length || wrongFmt.rows[0].date === null || wrongFmt.rows[0].date.toISOString().slice(0, 10) !== "2017-09-01") { console.error("FAIL: parseGeneric must re-probe the time format from data:", JSON.stringify(wrongFmt.rows.map(function (r) { return r.date; }))); process.exit(1); }
// Same protection on the strict path (re-load of a shared header shape with a persisted format).
const wrongFmtStrict = Core.parseWithMapping(
  ["Date", "Article_ID", "Country_Code", "Sold_Units"],
  [["2017-09-01", "332", "SE", "2"], ["2017-09-02", "332", "DK", "3"]],
  mkMap(["Date", "Article_ID", "Country_Code", "Sold_Units"], ["time", "product", "geography", "amount"], ["time", "identifier", "geo", "measure"]).map(function (c) { return c.name === "Date" ? Object.assign({}, c, { format: "yyyymmdd" }) : c; })
);
if (wrongFmtStrict.rows.length !== 2 || wrongFmtStrict.rows[0].date.toISOString().slice(0, 10) !== "2017-09-01") { console.error("FAIL: parseWithMapping must re-probe the time format from data:", JSON.stringify(wrongFmtStrict.rows)); process.exit(1); }

// ---- Phase 4: declarative metric engine (PRD test additions) ----

// 4.1 Every agg is correct against a fixture.
const aggChecks = [
  ["sum", [1, 2, 3, 4], 10],
  ["avg", [1, 2, 3, 4], 2.5],
  ["median", [1, 3, 5], 3],
  ["median", [1, 2, 3, 4], 2.5],
  ["count", [1, null, 3], 3],
  ["countDistinct", [1, 1, 2, 3, 3], 3],
  ["min", [4, 2, 9], 2],
  ["max", [4, 2, 9], 9],
  ["rate", ["true", "false", "yes", "no"], 0.5]
];
for (const [agg, vals, exp] of aggChecks) {
  const got = Core.Metrics.applyAgg(vals, agg);
  if (got !== exp) { console.error(`FAIL: applyAgg(${agg}) = ${got}, expected ${exp}`); process.exit(1); }
}
if (Core.Metrics.AGGS.length !== 8 || Core.Metrics.AGGS.indexOf("rate") === -1) { console.error("FAIL: AGGS list incomplete"); process.exit(1); }
console.log("phase 4.1 aggs: ok");

// 4.2 Computed fields via the safe expression parser (no eval). Field refs + arithmetic + functions.
if (Core.Metrics.evalExpr("LinePrice * Quantity", { LinePrice: 10, Quantity: 3 }, null) !== 30) { console.error("FAIL: evalExpr arithmetic"); process.exit(1); }
if (Core.Metrics.evalExpr("round(price * 0.9)", { price: 9.999 }, null) !== 9) { console.error("FAIL: evalExpr function call"); process.exit(1); }
if (Core.Metrics.evalExpr("a + b * 2", { a: 1, b: 2 }, null) !== 5) { console.error("FAIL: evalExpr precedence"); process.exit(1); }
let threw = false; try { Core.Metrics.evalExpr("a +", { a: 1 }, null); } catch (e) { threw = true; }
if (!threw) { console.error("FAIL: malformed expression must throw, not eval"); process.exit(1); }
console.log("phase 4.2 expr parser: ok");

// 4.3 measure returns a traceable object with value/rowsUsed/filterState/datasetId.
const m4Fields = ["Date", "Article_ID", "Country_Code", "Units"];
const m4Rows = [
  ["2024-01-05", "A1", "DE", "10"],
  ["2024-01-20", "A1", "FR", "5"],
  ["2024-02-10", "B2", "DE", "7"],
  ["2024-03-01", "B2", "AT", "0"]
];
const m4Map = mkMap(m4Fields, ["time", "product", "geography", "amount"], ["time", "identifier", "geo", "measure"]);
const m4 = Core.Metrics.measure(m4Rows, m4Map, { field: "amount", agg: "sum", label: "Total units", definition: "sum of amount" }, { datasetId: "ds1", filterState: { p: "x" } });
if (m4.value !== 22 || m4.rowsUsed !== 4 || m4.datasetId !== "ds1" || !m4.formatted || m4.agg !== "sum" || m4.filterState.p !== "x") { console.error("FAIL: measure traceable object wrong:", JSON.stringify(m4)); process.exit(1); }
console.log("phase 4.3 measure: ok");

// 4.4 metricPacks + computeMetric on a raw-array + mapping fixture (totalUnits).
const transDefs = Core.Metrics.metricPacks("transactions");
if (!transDefs.some(d => d.id === "totalUnits")) { console.error("FAIL: transactions metric pack missing totalUnits"); process.exit(1); }
const tuDef = transDefs.find(d => d.id === "totalUnits");
const tu = Core.Metrics.computeMetric(tuDef, m4Rows, m4Map, { datasetId: "ds1" });
if (!tu.available || tu.value !== 22 || tu.rowsUsed !== 4) { console.error("FAIL: computeMetric totalUnits:", JSON.stringify(tu)); process.exit(1); }
console.log("phase 4.4 computeMetric: ok");

// 4.5 columnIndex resolves by concept and by substring (stage -> OpportunityStage).
const opMap = mkMap(["OpportunityID", "OpportunityStage", "EstimatedValue"], ["opportunity", null, "amount"], ["identifier", "dimension", "measure"]);
if (Core.Metrics.columnIndex(opMap, "stage") !== 1) { console.error("FAIL: columnIndex substring ('stage')"); process.exit(1); }
if (Core.Metrics.columnIndex(opMap, "amount") !== 2) { console.error("FAIL: columnIndex concept ('amount')"); process.exit(1); }
console.log("phase 4.5 columnIndex: ok");

// 4.6 concentration: top-N share + Herfindahl index (A1=15, B2=7, total 22). topN=1 so only A1 is "top".
const conc = Core.Metrics.concentration(m4Rows, m4Map, "product", "amount", 1);
const expShare = 15 / 22, expHhi = (15 / 22) * (15 / 22) + (7 / 22) * (7 / 22);
if (Math.abs(conc.topShare - expShare) > 1e-9 || Math.abs(conc.herfindahl - expHhi) > 1e-9) { console.error("FAIL: concentration wrong:", JSON.stringify(conc)); process.exit(1); }
console.log("phase 4.6 concentration: ok");

// 4.7 Period comparison handles a missing prior period without throwing; rowsUsed matches filtered count.
const janFrom = new Date("2024-01-01").getTime(), janTo = new Date("2024-01-31").getTime();
const cmp = Core.Metrics.comparePeriods(m4Rows, m4Map, { field: "amount", agg: "sum" }, { fromMs: janFrom, toMs: janTo, datasetId: "ds1" });
if (cmp.current.value !== 15 || cmp.current.rowsUsed !== 2) { console.error("FAIL: comparePeriods current:", JSON.stringify(cmp.current)); process.exit(1); }
if (cmp.prior.value !== 0 || cmp.yearAgo.value !== 0) { console.error("FAIL: missing prior/year-ago must be 0, not throw:", JSON.stringify(cmp)); process.exit(1); }
if (cmp.deltaPct !== null) { console.error("FAIL: zero prior must yield null deltaPct, not division by zero"); process.exit(1); }
const janRows = Core.Metrics.filterByRange(m4Rows, m4Map, janFrom, janTo);
if (janRows.length !== 2) { console.error("FAIL: filterByRange count"); process.exit(1); }
console.log("phase 4.7 comparePeriods: ok");

// 4.8 bucketSeries + seasonalityOf over the fixture.
const ser = Core.Metrics.bucketSeries(m4Rows, m4Map, "month");
if (ser.length !== 3 || ser[0].units !== 15 || ser[1].units !== 7 || ser[2].units !== 0) { console.error("FAIL: bucketSeries:", JSON.stringify(ser)); process.exit(1); }
const sea = Core.Metrics.seasonalityOf(m4Rows, m4Map, "amount");
if (!sea.peak || sea.peak.month !== 0 || Math.abs(sea.peakDeviation - ((7.5 - 5.5) / 5.5)) > 1e-9) { console.error("FAIL: seasonalityOf:", JSON.stringify(sea)); process.exit(1); }
console.log("phase 4.8 bucketSeries/seasonality: ok");

// 4.9 A metric whose required field is absent reports available:false with a reason, never a fabricated value.
const noStageMap = mkMap(["OpportunityID", "EstimatedValue"], ["opportunity", "amount"], ["identifier", "measure"]);
const winDef = Core.Metrics.metricPacks("opportunities").find(d => d.id === "winRate");
const winR = Core.Metrics.computeMetric(winDef, m4Rows, noStageMap, { datasetId: "ds2" });
if (winR.available !== false || !/Missing column/i.test(winR.reason)) { console.error("FAIL: missing-field metric must be unavailable:", JSON.stringify(winR)); process.exit(1); }
console.log("phase 4.9 unavailable metric: ok");

// 4.10 Real-data regression: the metric engine's totalUnits on Historical_Data = 9,537 (v6 anchor).
const hdMap = mkMap(header, ["time", "product", "geography", "amount"], ["time", "identifier", "geo", "measure"]);
const hdTotal = Core.Metrics.computeMetric(transDefs.find(d => d.id === "totalUnits"), dataRows, hdMap, { datasetId: "hd" });
if (hdTotal.available !== true || hdTotal.value !== 9537 || hdTotal.rowsUsed !== 4849) { console.error("FAIL: metric engine totalUnits on Historical_Data:", JSON.stringify(hdTotal)); process.exit(1); }
console.log("phase 4.10 real-data totalUnits: ok");

// ---- Phase 5: spec-driven chart renderer (PRD test additions) ----

// 5.1 An invalid spec is rejected with a specific error and never reaches the renderer.
const sMap = mkMap(["Date", "Article_ID", "Country_Code", "Sold_Units"], ["time", "product", "geography", "amount"], ["time", "identifier", "geo", "measure"]);
const badType = Core.Charts.validateSpec({ type: "pie", x: { field: "Date" }, y: [{ field: "Sold_Units", agg: "sum" }] }, sMap);
if (badType.valid || !/unknown chart type/.test(badType.errors.join(" "))) { console.error("FAIL: unknown chart type must be rejected:", JSON.stringify(badType)); process.exit(1); }
const badField = Core.Charts.validateSpec({ type: "bar", x: { field: "Nope" }, y: [{ field: "Sold_Units", agg: "sum" }] }, sMap);
if (badField.valid || !/unknown x field/.test(badField.errors.join(" "))) { console.error("FAIL: unknown x field must be rejected:", JSON.stringify(badField)); process.exit(1); }
const badAgg = Core.Charts.validateSpec({ type: "bar", x: { field: "Date", bucket: "month" }, y: [{ field: "Sold_Units", agg: "medianish" }] }, sMap);
if (badAgg.valid || !/unknown y agg/.test(badAgg.errors.join(" "))) { console.error("FAIL: unknown agg must be rejected:", JSON.stringify(badAgg)); process.exit(1); }
const badDim = Core.Charts.validateSpec({ type: "bar", x: { field: "Date", bucket: "month" }, y: [{ field: "Article_ID", agg: "sum" }] }, sMap);
if (badDim.valid || !/dimension|identifier/i.test(badDim.errors.join(" "))) { console.error("FAIL: sum of an identifier must be rejected:", JSON.stringify(badDim)); process.exit(1); }
console.log("phase 5.1 invalid-spec rejection: ok");

// 5.2 Each chart type produces correct series data from a fixture (monthly total = 15,7,0).
const p5Rows = [
  ["2024-01-05", "A1", "DE", "10"],
  ["2024-01-20", "A1", "FR", "5"],
  ["2024-02-10", "B2", "DE", "7"],
  ["2024-03-01", "B2", "AT", "0"]
];
for (const type of ["line", "bar", "stackedBar", "groupedBar", "area", "scatter"]) {
  const spec = { type: type, x: { field: "Date", bucket: "month" }, y: [{ field: "Units", agg: "sum", label: "Units" }] };
  const series = Core.Charts.buildSeries(spec, p5Rows, m4Map, {});
  if (series.labels.length !== 3 || series.datasets.length !== 1) { console.error(`FAIL: ${type} series shape`, JSON.stringify(series)); process.exit(1); }
  const data = series.datasets[0].data;
  if (data[0] !== 15 || data[1] !== 7 || data[2] !== 0) { console.error(`FAIL: ${type} data`, JSON.stringify(data)); process.exit(1); }
}
console.log("phase 5.2 chart types: ok");

// 5.3 splitBy yields one dataset per split value, each correct.
const splitSpec = { type: "bar", x: { field: "Date", bucket: "month" }, y: [{ field: "Units", agg: "sum" }], splitBy: "Country_Code" };
const splitSeries = Core.Charts.buildSeries(splitSpec, p5Rows, m4Map, {});
if (splitSeries.datasets.length !== 3) { console.error("FAIL: splitBy dataset count (one per distinct split value)", JSON.stringify(splitSeries)); process.exit(1); }
// DE rows are Jan(10)+Feb(7); FR is Jan(5); AT is Mar(0).
const deSet = splitSeries.datasets.find(d => d.label.indexOf("DE") === 0);
const frSet = splitSeries.datasets.find(d => d.label.indexOf("FR") === 0);
if (!deSet || !frSet) { console.error("FAIL: splitBy datasets missing DE/FR", JSON.stringify(splitSeries.datasets.map(d => d.label))); process.exit(1); }
if (deSet.data[0] !== 10 || deSet.data[1] !== 7 || frSet.data[0] !== 5 || frSet.data[1] !== 0) { console.error("FAIL: splitBy data wrong", JSON.stringify({ de: deSet.data, fr: frSet.data })); process.exit(1); }
console.log("phase 5.3 splitBy: ok");

// 5.4 Overlays (regression) add a dataset without altering the base series.
const ovSpec = { type: "line", x: { field: "Date", bucket: "month" }, y: [{ field: "Units", agg: "sum" }], overlays: ["regression"] };
const ovSeries = Core.Charts.buildSeries(ovSpec, p5Rows, m4Map, {});
if (ovSeries.datasets.length !== 2 || ovSeries.datasets[1].label !== "Regression") { console.error("FAIL: regression overlay", JSON.stringify(ovSeries.datasets.map(d => d.label))); process.exit(1); }
if (ovSeries.datasets[0].data[0] !== 15) { console.error("FAIL: overlay must not alter base series"); process.exit(1); }
console.log("phase 5.4 overlays: ok");

// 5.5 Table type returns the same underlying values; sort/limit are honored.
const tableSeries = Core.Charts.buildSeries({ type: "table", x: { field: "Date", bucket: "month" }, y: [{ field: "Units", agg: "sum" }] }, p5Rows, m4Map, {});
if (tableSeries.labels.length !== 3 || tableSeries.datasets[0].data.length !== 3) { console.error("FAIL: table series", JSON.stringify(tableSeries)); process.exit(1); }
const descSpec = { type: "bar", x: { field: "Date", bucket: "month" }, y: [{ field: "Units", agg: "sum" }], sort: "desc", limit: 2 };
const descSeries = Core.Charts.buildSeries(descSpec, p5Rows, m4Map, {});
if (descSeries.labels.length !== 2 || descSeries.datasets[0].data[0] !== 15 || descSeries.datasets[0].data[1] !== 7) { console.error("FAIL: sort/limit", JSON.stringify({ labels: descSeries.labels, data: descSeries.datasets[0].data })); process.exit(1); }
console.log("phase 5.5 table + sort/limit: ok");

// 5.6 Categorical x (no bucket) groups by the field's distinct values.
const catSpec = { type: "bar", x: { field: "Country_Code" }, y: [{ field: "Units", agg: "sum" }] };
const catSeries = Core.Charts.buildSeries(catSpec, p5Rows, m4Map, {});
if (catSeries.labels.indexOf("DE") === -1 || catSeries.labels.indexOf("FR") === -1) { console.error("FAIL: categorical x labels", JSON.stringify(catSeries.labels)); process.exit(1); }
const deI = catSeries.labels.indexOf("DE");
if (catSeries.datasets[0].data[deI] !== 17) { console.error("FAIL: categorical x DE sum (10+7)", JSON.stringify(catSeries.datasets[0].data)); process.exit(1); }
console.log("phase 5.6 categorical x: ok");

// ---- Phase 6: AI as an analyst with tools (PRD test additions) ----

// 6.1 The fallback JSON protocol parses a valid tool block.
const tb = Core.Tools.parseToolBlock('Some prose\n```json\n{"tool":"query","args":{"dataset":"hd","measures":[{"field":"Units","agg":"sum"}]}}\n```');
if (!tb || tb.tool !== "query" || !tb.args || !tb.args.measures) { console.error("FAIL: parseToolBlock valid block", JSON.stringify(tb)); process.exit(1); }
console.log("phase 6.1 parseToolBlock: ok");

// 6.2 A malformed block produces a corrective message rather than a crash.
const badTool = Core.Tools.parseToolBlock('```json\n{"tool": "query", "args": {}\n```');
if (!badTool || !badTool.error) { console.error("FAIL: malformed tool block must yield a corrective error", JSON.stringify(badTool)); process.exit(1); }
const notool = Core.Tools.parseToolBlock('{"args": {}}');
if (!notool || !notool.error) { console.error("FAIL: block missing 'tool' must be rejected", JSON.stringify(notool)); process.exit(1); }
const none = Core.Tools.parseToolBlock("Just a plain answer, no tool call.");
if (none !== null) { console.error("FAIL: no tool block must return null", JSON.stringify(none)); process.exit(1); }
console.log("phase 6.2 malformed block: ok");

// 6.3/6.4/6.5 Tool loop semantics (async toolLoop). Wrap in an async IIFE.
const ctx6 = {
  datasets: [{ id: "hd", name: "Historical", kind: "transactions", rowCount: 4, hasData: true, mapping: m4Map, rowsArr: m4Rows }],
  createChart: (spec) => "chart-1",
  getChartData: (id) => id === "chart-1" ? { labels: ["a"], datasets: [{ label: "x", data: [1] }] } : null
};
(async () => {
let calls = 0;
const loopResult = await Core.Tools.toolLoop({
  maxTurns: 4,
  context: ctx6,
  messages: [{ role: "user", content: "What's the total?" }],
  callModel: (msgs) => {
    calls++;
    if (calls === 1) return { content: '{"tool":"query","args":{"dataset":"hd","measures":[{"field":"Units","agg":"sum"}]}}' };
    return { content: "The total units are 22." };
  }
});
if (loopResult.turns !== 1 || loopResult.results.length !== 1 || loopResult.results[0].tool !== "query") { console.error("FAIL: toolLoop should run one tool then finish", JSON.stringify(loopResult)); process.exit(1); }
// No dimensions requested -> one aggregate row with the summed Units (10+5+7+0 = 22).
const qrows = loopResult.results[0].result.rows;
if (qrows.length !== 1 || qrows[0].Units !== 22) { console.error("FAIL: query tool aggregate result", JSON.stringify(qrows)); process.exit(1); }
if (!loopResult.results[0].result.resultId) { console.error("FAIL: query must return a resultId"); process.exit(1); }
if (!/22/.test(loopResult.content)) { console.error("FAIL: final answer content", loopResult.content); process.exit(1); }
console.log("phase 6.3 toolLoop executes: ok");

// 6.4 The loop terminates at the cap and reports hitCap.
let capCalls = 0;
const capResult = await Core.Tools.toolLoop({
  maxTurns: 2,
  context: ctx6,
  messages: [{ role: "user", content: "keep going" }],
  callModel: () => { capCalls++; return { content: '{"tool":"list_datasets","args":{}}' }; }
});
if (!capResult.hitCap || capResult.turns !== 2 || capCalls !== 2) { console.error("FAIL: toolLoop must stop at maxTurns and set hitCap", JSON.stringify({ turns: capResult.turns, hitCap: capResult.hitCap, calls: capCalls })); process.exit(1); }
console.log("phase 6.4 loop cap: ok");

// 6.5 A malformed tool block mid-loop yields a corrective message to the model and continues.
let corrCalls = 0;
const corrResult = await Core.Tools.toolLoop({
  maxTurns: 4,
  context: ctx6,
  messages: [{ role: "user", content: "go" }],
  callModel: () => {
    corrCalls++;
    if (corrCalls === 1) return { content: '{"tool": "list_datasets", "args": {}}' }; // valid
    if (corrCalls === 2) return { content: '{"tool": "broken", args: {}}' }; // malformed (unquoted key -> JSON.parse fails)
    return { content: "done" };
  }
});
// Turn 1 valid tool, turn 2 malformed -> corrective, turn 3 final answer. Tool turns=2 (the answer isn't a tool turn).
if (corrResult.turns !== 2 || corrResult.hitCap || corrResult.results.length !== 1) { console.error("FAIL: malformed mid-loop should not crash; should continue", JSON.stringify(corrResult)); process.exit(1); }
if (!/done/.test(corrResult.content)) { console.error("FAIL: loop should reach the final answer after a corrective message", corrResult.content); process.exit(1); }
console.log("phase 6.5 malformed mid-loop: ok");

// 6.6 describe_schema returns column type/role/distinct/samples.
const dsRes = Core.Tools.runTool("describe_schema", { datasetId: "hd" }, ctx6);
if (!dsRes.columns || dsRes.columns.length !== 4 || dsRes.columns[0].role !== "time") { console.error("FAIL: describe_schema", JSON.stringify(dsRes)); process.exit(1); }
console.log("phase 6.6 describe_schema: ok");

// 6.7 openProfile produces a deterministic profile (total, top, coverage) without blocking on the model.
const objRows = [
  { date: new Date("2024-01-05"), articleId: "A1", countryCode: "DE", units: 10 },
  { date: new Date("2024-01-20"), articleId: "A1", countryCode: "FR", units: 5 },
  { date: new Date("2024-02-10"), articleId: "B2", countryCode: "DE", units: 7 },
  { date: new Date("2024-03-01"), articleId: "B2", countryCode: "AT", units: 0 }
];
const prof = Core.Tools.openProfile(objRows, m4Map, "month");
if (prof.total !== 22 || !prof.top || !prof.coverage || !prof.coverage.product || !prof.coverage.geography) { console.error("FAIL: openProfile", JSON.stringify(prof)); process.exit(1); }
console.log("phase 6.7 openProfile: ok");

// ---- Relational data access (charts + metrics across declared joins) ----
// A chart/metric may reference a field that lives on another dataset. enrichView follows the
// declared join graph to build a virtual enriched view of the base dataset.

// Base = transactions (has amount/units). Products = dimension (has product label). A chart on the
// base that references a product concept absent from the base should enrich from the Products dataset.
const relBaseFields = ["Date", "Country_Code", "Units", "Item_No"];
const relBaseRows = [
  ["2024-01-05", "DE", "10", "P1"],
  ["2024-01-20", "FR", "5", "P1"],
  ["2024-02-10", "DE", "7", "P2"]
];
const relBaseMap = mkMap(relBaseFields, ["time", "geography", "amount", "product"], ["time", "geo", "measure", "identifier"]);
const relProdFields = ["Item_No", "Item_Name", "Category"];
const relProdRows = [["P1", "Widget", "Books"], ["P2", "Gadget", "Toys"]];
const relProdMap = mkMap(relProdFields, ["product", null, null], ["identifier", "dimension", "dimension"]);
const relDS = {
  base: { id: "dsBase", name: "Sales", kind: "transactions", hasData: true, mapping: relBaseMap, rowsArr: relBaseRows },
  prod: { id: "dsProd", name: "Products", kind: "generic", hasData: true, mapping: relProdMap, rowsArr: relProdRows }
};
const relJoins = [
  { id: "j1", from: "dsBase", fromConcept: "product", to: "dsProd", toConcept: "product", index: Core.Joins.buildIndex(relProdRows, relProdMap, "product") }
];
const byId = {}; Object.keys(relDS).forEach(k => byId[relDS[k].id] = relDS[k]);

// 7.1 enrichView appends a field from a joined dataset and leaves the base unchanged when present.
const view = Core.Joins.enrichView({ id: "dsBase", mapping: relBaseMap, rowsArr: relBaseRows }, ["Item_Name"], relJoins, byId);
if (!view || view.mapping.length !== 5 || view.rowsArr.length !== 3) { console.error("FAIL: enrichView shape", JSON.stringify(view && { map: view.mapping.length, rows: view.rowsArr.length })); process.exit(1); }
if (view.rowsArr[0][4] !== "Widget" || view.rowsArr[2][4] !== "Gadget") { console.error("FAIL: enrichView joined label", JSON.stringify(view.rowsArr.map(r => r[4]))); process.exit(1); }
const noView = Core.Joins.enrichView({ id: "dsBase", mapping: relBaseMap, rowsArr: relBaseRows }, ["Units"], relJoins, byId);
if (noView !== null) { console.error("FAIL: enrichView must return null when no enrichment needed"); process.exit(1); }
console.log("relational 7.1 enrichView: ok");

// 7.2 A chart on the base dataset splitBy a joined dimension resolves through the join.
const relChart = Core.Charts.buildSeries({ type: "bar", x: { field: "Date", bucket: "month" }, y: [{ field: "Units", agg: "sum" }], splitBy: "Item_Name" }, view.rowsArr, view.mapping, {});
if (relChart.datasets.length !== 2) { console.error("FAIL: relational chart splitBy", JSON.stringify(relChart.datasets.map(d => d.label))); process.exit(1); }
const widget = relChart.datasets.find(d => d.label.indexOf("Widget") === 0);
if (!widget || widget.data[0] !== 15 || widget.data[1] !== 0) { console.error("FAIL: relational chart Widget data", JSON.stringify(widget)); process.exit(1); }
console.log("relational 7.2 chart splitBy joined dim: ok");

// 7.3 enrichView leaves the base mapping intact when the field is already present (no false enrichment).
const baseOnly = Core.Joins.enrichView({ id: "dsBase", mapping: relBaseMap, rowsArr: relBaseRows }, ["Country_Code"], relJoins, byId);
if (baseOnly !== null) { console.error("FAIL: field already present must not enrich"); process.exit(1); }
console.log("relational 7.3 no-op when field present: ok");

// ---- Phase 7: Verification layer (PRD test additions) ----

// 8.1 An answer containing a fabricated number is flagged; an answer whose numbers all appear in
// tool results is fully verified.
const toolRes = [
  { tool: "query", result: { resultId: "r1", rows: [{ Units: 22 }], count: 1 } },
  { tool: "query", result: { resultId: "r2", rows: [{ Units: 9537 }], count: 1 } }
];
const okClaims = Core.Verify.checkClaims("Total units are 22 [r1] and 9537 [r2].", toolRes);
if (okClaims.verifiedCount !== 2 || okClaims.totalCount !== 2 || okClaims.unverified.length !== 0) { console.error("FAIL: fully-verified answer", JSON.stringify(okClaims)); process.exit(1); }
const fabClaims = Core.Verify.checkClaims("Total units are 22 and 99.", toolRes);
if (fabClaims.verifiedCount !== 1 || fabClaims.unverified.length !== 1 || fabClaims.unverified[0].value !== 99) { console.error("FAIL: fabricated number must be flagged", JSON.stringify(fabClaims)); process.exit(1); }
console.log("phase 8.1 claim check: ok");

// 8.2 extractNumbers handles decimals, thousands separators, percentages.
const ex = Core.Verify.extractNumbers("Revenue was 1,234.5 (45%) and -7 units.");
const vals = ex.map(n => n.value);
if (vals[0] !== 1234.5 || vals[1] !== 45 || vals[2] !== -7) { console.error("FAIL: extractNumbers", JSON.stringify(vals)); process.exit(1); }
console.log("phase 8.2 extractNumbers: ok");

// 8.3 Empty-result honesty: an unverified figure after an empty query is flagged as fabrication.
const emptyRes = [{ tool: "query", result: { resultId: "r3", rows: [], count: 0 } }];
const emptyClaims = Core.Verify.checkClaims("We had 5 deals in that segment.", emptyRes);
if (emptyClaims.emptyResult !== true || emptyClaims.fabricated !== true || emptyClaims.unverified.length !== 1) { console.error("FAIL: empty-result honesty", JSON.stringify(emptyClaims)); process.exit(1); }
if (!Core.Verify.hasEmptyResult(emptyRes)) { console.error("FAIL: hasEmptyResult"); process.exit(1); }
console.log("phase 8.3 empty-result honesty: ok");

// 8.4 parseCitations extracts resultId chips in order, deduplicated.
const cites = Core.Verify.parseCitations("As [r1] shows, and [r2], and [r1] again.");
if (cites.join(",") !== "r1,r2") { console.error("FAIL: parseCitations", JSON.stringify(cites)); process.exit(1); }
console.log("phase 8.4 parseCitations: ok");

// 8.5 provenance + definition registry.
const prov = Core.Verify.provenance({ dataset: "ds1", sourceFile: "sales.csv", rowsUsed: 4849, definition: "sum of units" });
if (prov.dataset !== "ds1" || prov.rowsUsed !== 4849 || !prov.generatedAt) { console.error("FAIL: provenance", JSON.stringify(prov)); process.exit(1); }
const reg = Core.Verify.definitionRegistry(Core.Metrics.metricPacks("transactions"));
if (!reg.totalUnits || reg.totalUnits.definition.indexOf("Sum") !== 0) { console.error("FAIL: definitionRegistry", JSON.stringify(reg.totalUnits)); process.exit(1); }
console.log("phase 8.5 provenance + definition registry: ok");

console.log("\nALL CHECKS PASSED");
})();
