const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");

// Extract each <script>...</script> block (no src) in order.
const blocks = [];
let re = /<script>([\s\S]*?)<\/script>/g, m;
while ((m = re.exec(html)) !== null) blocks.push(m[1]);
console.log("inline script blocks:", blocks.length);

// Fake browser globals.
const window = {};
window.addEventListener = () => {};
global.window = window;
global.Chart = undefined; global.Papa = undefined;

for (let i = 0; i < blocks.length; i++) {
  const src = blocks[i];
  if (/PapaParse|Chart\.js/.test(src.slice(0, 200))) {
    try { new Function("window", "document", src)(window, {}); }
    catch (e) { console.error("FAIL: inlined lib block " + i + " threw:", e.message); process.exit(1); }
  }
}

const g = globalThis;
console.log("Papa set (window or global):", !!(window.Papa || g.Papa));
console.log("Chart set (window or global):", !!(window.Chart || g.Chart));
if (!window.Papa && !g.Papa) { console.error("FAIL: PapaParse global missing after inlined eval"); process.exit(1); }
if (!window.Chart && !g.Chart) { console.error("FAIL: Chart.js global missing after inlined eval"); process.exit(1); }

// Confirm no external CDN references remain.
const cdn = html.match(/https:\/\/cdn\.jsdelivr\.net[^"']*/g);
console.log("remaining CDN refs:", cdn ? cdn.length : 0);
if (cdn && cdn.length) { console.error("FAIL: still referencing CDN"); process.exit(1); }

// Confirm the app's own SalesCore block is intact and parses.
const s = html.indexOf("* SalesCore"), e = html.indexOf("</script>", s);
try { new Function(html.slice(html.lastIndexOf("<script>", s), e).replace(/^<script>/, "")); console.log("SalesCore block: OK"); }
catch (err) { console.error("FAIL: SalesCore syntax:", err.message); process.exit(1); }

console.log("\nSELF-CONTAINED CHECK PASSED — no network needed to load libs");
