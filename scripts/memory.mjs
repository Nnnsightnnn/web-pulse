// Memory — compares today's items with the daily history snapshots so every
// item knows whether it is new, climbing, holding or falling, and for how long
// it has been on its chart. Without this the briefing cannot tell "GTA VI is
// new today" from "GTA VI has led for five days", and repeats itself.
//
// Adds fields only (days_on, prior_rank, movement); never renames existing ones.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOOKBACK_DAYS = 14;

export function titleKey(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Prior snapshots for one source, newest first, strictly before `today`
// (a same-day re-run must not compare against itself).
export function priorDays(historyDir, source, today, days = LOOKBACK_DAYS) {
  const dir = join(historyDir, source);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f.slice(0, 10) < today)
    .sort()
    .reverse()
    .slice(0, days)
    .map((f) => {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
        const ranks = new Map();
        for (const it of data.items || []) {
          const k = titleKey(it.title);
          if (k && !ranks.has(k)) ranks.set(k, it.rank);
        }
        return { date: f.slice(0, 10), ranks };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function dayBefore(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Classify one item against the prior days of its own source.
export function classify(item, prior, today) {
  const k = titleKey(item.title);
  // days_on counts today plus each consecutive calendar day before it.
  let days_on = 1;
  let expect = dayBefore(today);
  for (const day of prior) {
    if (day.date !== expect || !day.ranks.has(k)) break;
    days_on++;
    expect = dayBefore(expect);
  }
  const last = prior[0];
  const prior_rank = last && last.date === dayBefore(today) ? last.ranks.get(k) ?? null : null;
  let movement;
  if (prior_rank == null) {
    const seenRecently = prior.some((d) => d.ranks.has(k));
    movement = seenRecently ? "returning" : "new";
  } else if (item.rank < prior_rank - 1) {
    movement = "climbing";
  } else if (item.rank > prior_rank + 1) {
    movement = "falling";
  } else {
    movement = "holding";
  }
  return { days_on, prior_rank, movement };
}

// Mutates each live source's items in place with movement fields.
export function annotateMovement(sources, historyDir, today) {
  for (const [name, data] of Object.entries(sources || {})) {
    if (data.error || !Array.isArray(data.items)) continue;
    const prior = priorDays(historyDir, name, today);
    for (const item of data.items) Object.assign(item, classify(item, prior, today));
  }
  return sources;
}
