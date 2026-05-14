// ═══════════════════════════════════════════════════════════════
//  TEST RUN — generates Day 1 locally so you can review output
//  without touching GitHub. Set your API key in .env first.
//  Usage: node scripts/test-run.js
// ═══════════════════════════════════════════════════════════════

import { config } from "dotenv";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

config(); // loads .env file

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

console.log("🧪 TEST MODE — running generator locally\n");
console.log("API Key present:", !!process.env.ANTHROPIC_API_KEY);
console.log("HF Token present:", !!process.env.HF_TOKEN);
console.log("Root directory:", ROOT);
console.log("");

// Verify story-bible.json exists
const biblePath = path.join(ROOT, "story-bible.json");
if (!fs.existsSync(biblePath)) {
  console.error("❌ story-bible.json not found at", biblePath);
  console.error("   Make sure you run this from the repo root.");
  process.exit(1);
}

// Run the generator
try {
  execSync("node scripts/generate.js", {
    stdio: "inherit",
    cwd: ROOT,
    env: process.env,
  });
  console.log("\n✅ Test run complete. Check pages/ folder for output.");
} catch (err) {
  console.error("\n❌ Test run failed:", err.message);
  process.exit(1);
}
