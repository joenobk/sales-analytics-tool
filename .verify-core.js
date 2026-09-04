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

// 9. Phase 0: all eight named modules present on the namespace
for (const modName of ["Schema", "Store", "Metrics", "Charts", "Insight", "Text", "Report", "AI"]) {
  if (!Core[modName] || typeof Core[modName] !== "object") { console.error(`FAIL: module ${modName} missing on SalesCore`); process.exit(1); }
}
console.log("modules present:", ["Schema","Store","Metrics","Charts","Insight","Text","Report","AI"].join(", "));

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

console.log("\nALL CHECKS PASSED");
