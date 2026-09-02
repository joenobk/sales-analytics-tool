// Headless verification of SalesCore logic extracted from index.html
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const startMarker = html.indexOf("* SalesCore");
const endMarker = html.indexOf("</script>", startMarker);
if (startMarker === -1 || endMarker === -1) { console.error("FAIL: could not extract SalesCore script block"); process.exit(1); }
let src = html.slice(html.lastIndexOf("<script>", startMarker), endMarker).replace(/^<script>/, "");
const mod = { exports: {} };
new Function("module", "window", src)(mod, {});
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

console.log("\nALL CHECKS PASSED");
