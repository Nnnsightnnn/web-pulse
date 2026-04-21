// Orchestrator — runs every source in parallel, writes latest.json and a
// per-source daily snapshot to data/history/<source>/<YYYY-MM-DD>.json.
//
// Designed for Promise.allSettled so a single flaky source never takes down the
// whole run. Each source's section of latest.json includes either its items or
// an error payload the dashboard can render.

// Env loader MUST be the first import so secrets are in process.env
// before any source module's top-level code runs.
import "./env.mjs";

import { writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import wikipedia from "./sources/wikipedia.mjs";
import hackernews from "./sources/hackernews.mjs";
import reddit from "./sources/reddit.mjs";
import github from "./sources/github-trending.mjs";
import googleTrends from "./sources/google-trends.mjs";
import cloudflareRadar from "./sources/cloudflare-radar.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const HISTORY_DIR = join(DATA_DIR, "history");

const SOURCES = [
  { name: "wikipedia", fn: wikipedia },
  { name: "hackernews", fn: hackernews },
  { name: "reddit", fn: reddit },
  { name: "github", fn: github },
  { name: "google-trends", fn: googleTrends },
  { name: "cloudflare-radar", fn: cloudflareRadar },
];

function dateStamp() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function run() {
  console.log(`[web-pulse] fetching ${SOURCES.length} sources…`);
  const start = Date.now();

  const settled = await Promise.allSettled(
    SOURCES.map(async (s) => {
      const t = Date.now();
      try {
        const data = await s.fn();
        console.log(`  ✓ ${s.name} (${Date.now() - t}ms, ${data.items?.length ?? 0} items)`);
        return { name: s.name, status: "ok", data };
      } catch (err) {
        console.error(`  ✗ ${s.name} (${Date.now() - t}ms):`, err.message);
        throw err;
      }
    })
  );

  const byName = {};
  settled.forEach((r, i) => {
    const name = SOURCES[i].name;
    if (r.status === "fulfilled") {
      byName[name] = r.value.data;
    } else {
      byName[name] = {
        source: name,
        fetched_at: new Date().toISOString(),
        error: r.reason?.message || String(r.reason),
        items: [],
      };
    }
  });

  const latest = {
    generated_at: new Date().toISOString(),
    sources: byName,
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, "latest.json"), JSON.stringify(latest, null, 2));

  // Per-source daily history snapshots.
  const stamp = dateStamp();
  for (const [name, payload] of Object.entries(byName)) {
    if (payload.error) continue;
    const dir = join(HISTORY_DIR, name);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${stamp}.json`), JSON.stringify(payload, null, 2));
  }

  // Prune history older than 30 days to keep the repo small.
  await pruneOldHistory(180);

  console.log(`[web-pulse] done in ${Date.now() - start}ms → data/latest.json`);
}

async function pruneOldHistory(daysToKeep) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - daysToKeep);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  try {
    const sourceDirs = await readdir(HISTORY_DIR).catch(() => []);
    for (const sd of sourceDirs) {
      const full = join(HISTORY_DIR, sd);
      const files = await readdir(full).catch(() => []);
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        const date = f.replace(/\.json$/, "");
        if (date < cutoffStr) {
          const { unlink } = await import("node:fs/promises");
          await unlink(join(full, f));
        }
      }
    }
  } catch (err) {
    console.warn("[web-pulse] history prune failed:", err.message);
  }
}

run().catch((err) => {
  console.error("[web-pulse] fatal:", err);
  process.exit(1);
});
