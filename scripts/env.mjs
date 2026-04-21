// Lightweight .env loader — no external dependency.
// Populates process.env from ../.env if present. Silent if the file is missing.
// Imported as the first import in fetch-all.mjs so its side effects run
// before any source module's top-level code.
//
// Tolerant of:
//   - Leading/trailing whitespace around key and value ("KEY = value" works)
//   - Surrounding single or double quotes ("KEY='value'")
//   - Blank lines and #-prefixed comments

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let [, key, val] = m;
    val = val.trim();
    const quoted = val.match(/^(['"])(.*)\1$/);
    if (quoted) val = quoted[2];
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // No .env file — fine. Sources that need secrets will report themselves
  // as unconfigured.
}
