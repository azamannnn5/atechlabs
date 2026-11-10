// Netlify build step: copies the public site into dist/ and writes the Supabase config
// from environment variables. Secret keys are never written to any file.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "dist");
const SKIP = new Set(["dist", "node_modules", "netlify", "tools", "supabase", "setup", ".git", "netlify.toml", "package.json", "package-lock.json"]);
fs.rmSync(OUT, { recursive: true, force: true });
function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (src === ROOT && SKIP.has(name)) continue;
    const s = path.join(src, name), d = path.join(dst, name);
    fs.statSync(s).isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  }
}
copy(ROOT, OUT);
const url = (process.env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_ANON_KEY || "").trim();
const cfg = url && key ? { url, anonKey: key } : {};
const body = "window.CMS_CONFIG=" + JSON.stringify(cfg) + ";\n";
fs.writeFileSync(path.join(OUT, "static/js/cms-config.js"), body);
fs.writeFileSync(path.join(OUT, "admin/config.js"), body);
console.log(url && key ? "Supabase config written." : "No Supabase env vars found: site will run with its original content.");
