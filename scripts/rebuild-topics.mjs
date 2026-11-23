// rebuild-topics.mjs — replays the daily history through the same memory,
// clustering and topic code the nightly fetch uses, oldest day first, so the
// topic store knows which stories are genuinely new. Explainers already in the
// store are kept; only timelines, phases and the queue are rebuilt.
//
//   node scripts/rebuild-topics.mjs [days=14]

import { readdirSync, readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { annotateMovement } from "./memory.mjs";
import { clusterItems } from "./cluster.mjs";
import { updateTopics, loadTopics, writeIndex } from "./topics.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HISTORY_DIR = join(ROOT, "data", "history");
const TOPICS_DIR = join(ROOT, "data", "topics");

const days = Number(process.argv[2]) || 14;
const dates = [
  ...new Set(
    readdirSync(HISTORY_DIR).flatMap((s) =>
      existsSync(join(HISTORY_DIR, s)) ? readdirSync(join(HISTORY_DIR, s)).map((f) => f.slice(0, 10)) : []
    )
  ),
]
  .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  .sort()
  .slice(-days);

// Keep researched explainers across the rebuild.
const kept = new Map(loadTopics(TOPICS_DIR).filter((t) => t.explainer || t.research_skipped).map((t) => [t.id, t]));
rmSync(TOPICS_DIR, { recursive: true, force: true });
mkdirSync(TOPICS_DIR, { recursive: true });

let index;
for (const date of dates) {
  const sources = {};
  for (const s of readdirSync(HISTORY_DIR)) {
    const f = join(HISTORY_DIR, s, `${date}.json`);
    if (existsSync(f)) sources[s] = JSON.parse(readFileSync(f, "utf8"));
  }
  annotateMovement(sources, HISTORY_DIR, date);
  const clusters = clusterItems(sources);
  index = updateTopics({ generated_at: `${date}T06:15:00.000Z`, sources, clusters }, TOPICS_DIR, date);
  console.log(`  ${date}: ${clusters.length} clusters, ${index.topics.length} active topics`);
}

for (const t of loadTopics(TOPICS_DIR)) {
  const old = kept.get(t.id);
  if (!old) continue;
  t.explainer = old.explainer || null;
  t.explainer_history = old.explainer_history || [];
  if (old.research_skipped) t.research_skipped = old.research_skipped;
  t.needs_research = false; // already handled; the next nightly run re-judges it
  writeFileSync(join(TOPICS_DIR, `${t.id}.json`), JSON.stringify(t, null, 2) + "\n");
}
if (index) writeIndex(TOPICS_DIR, loadTopics(TOPICS_DIR), index.date, index.generated_at);
console.log(`rebuilt ${dates.length} days (${dates[0]} to ${dates[dates.length - 1]}), ${kept.size} explainers and skips kept`);
