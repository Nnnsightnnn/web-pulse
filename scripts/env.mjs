// Lightweight .env loader — no external dependency.
// Populates process.env from ../.env if present. Silent if the file is missing.
// Imported as the first import in fetch-all.mjs so its side effects run
// before any source module's top-level code.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.trim().match(/^([A-Z0-9_]+)=(.*)$/i);
    if (!m) continue;
    let [, key, val] = m;
    val = val.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // No .env file — fine. Sources that need secrets will report themselves
  // as unconfigured.
}
