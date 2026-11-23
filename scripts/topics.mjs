// Topics — Web Pulse's long memory. Each story the feeds carry becomes one file
// in data/topics/<id>.json that persists across days: when it was first seen,
// every day it showed up and on which feeds, its phase, and a researched
// explainer written by the web-pulse-refresh task (see scripts/explainer.mjs).
//
// This module is deterministic: it decides which stories exist, how they are
// moving, and which ones need research. It never writes explainer prose.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tokenize, numeralsConflict } from "./cluster.mjs";

export const ACTIVE_DAYS = 10; // a topic unseen this long leaves the index
const FADING_DAYS = 3;
const KEEP_DAYS = 180; // matches the history retention
const TIMELINE_MAX = 60;
const RESEARCH_CAP = 4; // explainers per night; the task's web budget
const RESEARCH_REFRESH_DAYS = 3; // a climbing topic gets a fresh look after this

// "warriors vs celtics", "49ers x vikings": a game people are looking up.
// Worth remembering, not worth a nightly explainer.
const MATCHUP = /^\S.*\s(vs\.?|v|x|at)\s\S/i;
const SEARCH_ONLY = new Set(["google-trends", "polymarket"]);

// Feed titles that are standing pages, not stories.
const SKIP_TITLE = /^(deaths in|list of|main page|special:|portal:|wikipedia:|file:|\d{4} in )/i;

export function slugify(name) {
  return (
    String(name || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "topic"
  );
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5);
}

function itemUrl(item, source) {
  if (source === "hackernews") return item.hn_url || item.url || null;
  if (source === "google-trends") return item.news_url || null;
  return item.url || null;
}

function live(sources, key) {
  const s = sources?.[key];
  return s && !s.error && Array.isArray(s.items) ? s.items : [];
}

// Today's candidate stories: every cross-feed cluster near the top, plus the
// strongest single-feed movers from the feeds where people (not bots) decide
// what rises. Each carries a signal so the research queue can rank them.
export function candidates(latest) {
  const out = [];
  for (const c of (latest.clusters || []).slice(0, 8)) {
    out.push({
      name: c.name,
      sources: c.sources,
      items: (c.items || []).slice(0, 4).map(({ source, title, url, rank, movement }) => ({ source, title, url, rank, movement })),
      signal: c.score,
      kind: "cluster",
    });
  }
  // Every top item counts toward memory, holding or not, so a story that
  // sits at #1 for a week keeps its day count. Phase and the research queue
  // decide what is fresh; this list only decides what is worth remembering.
  const singles = [
    ["wikipedia", 10],
    ["google-trends", 5],
    ["hackernews", 3],
  ];
  for (const [key, n] of singles) {
    for (const it of live(latest.sources, key).slice(0, n)) {
      if (!it.title || SKIP_TITLE.test(it.title)) continue;
      out.push({
        name: it.title,
        sources: [key],
        items: [{ source: key, title: it.title, url: itemUrl(it, key), rank: it.rank, movement: it.movement }],
        signal: 0.8 / it.rank,
        kind: "single",
      });
    }
  }
  return out.filter((c) => c.name && !SKIP_TITLE.test(c.name));
}

function tokensOf(names) {
  const all = new Set();
  for (const n of names) for (const t of tokenize(n)) all.add(t);
  return all;
}

// Same story? Exact slug, or enough shared words with any name the topic has
// carried. Two shared words and 40% overlap is the cluster rule, loosened
// slightly because topic aliases accumulate words over days.
export function sameStory(candTokens, topic) {
  for (const alias of topic.aliases || [topic.name]) {
    const t = tokenize(alias);
    if (numeralsConflict(candTokens, t)) continue;
    let overlap = 0;
    for (const tok of candTokens) if (t.has(tok)) overlap++;
    if (overlap === 0) continue;
    const union = new Set([...candTokens, ...t]).size;
    if (overlap === candTokens.size && overlap === t.size) return true;
    if (overlap >= 2 && overlap / union >= 0.4) return true;
  }
  return false;
}

export function loadTopics(topicsDir) {
  if (!existsSync(topicsDir)) return [];
  return readdirSync(topicsDir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(topicsDir, f), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function phaseOf(topic, today) {
  const last = topic.timeline[topic.timeline.length - 1];
  if (topic.last_seen !== today) {
    return daysBetween(topic.last_seen, today) <= FADING_DAYS ? "fading" : "closed";
  }
  if (topic.first_seen === today) return "new";
  const prev = topic.timeline[topic.timeline.length - 2];
  if (!prev || daysBetween(prev.date, today) > 1) return "climbing"; // back after a gap
  // Climbing means the story as a whole grew: a clearly stronger signal, or a
  // new feed picking it up without the signal falling. One item ticking up a
  // rank while the rest slide is still holding.
  const grewSignal = last.signal > prev.signal * 1.25;
  const newFeed = last.sources.length > prev.sources.length && last.signal >= prev.signal;
  if (grewSignal || newFeed) return "climbing";
  return "holding";
}

function wantsResearch(topic, today) {
  if (topic.last_seen !== today || topic.phase === "fading" || topic.phase === "closed") return false;
  if (MATCHUP.test(topic.name) && topic.sources_seen.every((s) => SEARCH_ONLY.has(s))) return false;
  const ex = topic.explainer;
  // A skip (no good page found, or a story that gets no explainer) holds for
  // two days so the queue doesn't spend every night on the same dead end.
  const skipped = topic.research_skipped?.at;
  if (skipped && daysBetween(skipped.slice(0, 10), today) < 2) return false;
  if (!ex) return true;
  return topic.phase === "climbing" && daysBetween(ex.researched_at.slice(0, 10), today) >= RESEARCH_REFRESH_DAYS;
}

export function indexEntry(t) {
  const ex = t.explainer;
  const last = t.timeline[t.timeline.length - 1] || {};
  return {
    id: t.id,
    name: t.name,
    aliases: t.aliases,
    phase: t.phase,
    first_seen: t.first_seen,
    last_seen: t.last_seen,
    days_seen: t.days_seen,
    sources_seen: t.sources_seen,
    signal: last.date === t.last_seen ? Number((last.signal || 0).toFixed(3)) : 0,
    url: (last.items || []).find((i) => i.url)?.url || null,
    summary: ex?.summary || null,
    why_now: ex?.why_now || null,
    researched_at: ex?.researched_at || null,
    needs_research: !!t.needs_research,
  };
}

export function buildIndex(topics, today, generated_at) {
  const active = topics
    .filter((t) => daysBetween(t.last_seen, today) <= ACTIVE_DAYS)
    .map(indexEntry)
    .sort((a, b) => (a.last_seen === b.last_seen ? b.signal - a.signal : a.last_seen < b.last_seen ? 1 : -1));
  return {
    generated_at,
    date: today,
    topics: active,
    research_queue: active.filter((t) => t.needs_research).map((t) => t.id),
  };
}

export function writeIndex(topicsDir, topics, today, generated_at) {
  const index = buildIndex(topics, today, generated_at);
  writeFileSync(join(topicsDir, "index.json"), JSON.stringify(index, null, 2) + "\n");
  return index;
}

// Fold today's candidates into the store. Returns the index.
export function updateTopics(latest, topicsDir, today) {
  mkdirSync(topicsDir, { recursive: true });
  const generated_at = latest.generated_at || new Date().toISOString();
  const topics = loadTopics(topicsDir);
  const byId = new Map(topics.map((t) => [t.id, t]));
  const touched = new Set();

  for (const c of candidates(latest)) {
    const ct = tokensOf([c.name]);
    if (ct.size === 0) continue;
    const slug = slugify(c.name);
    let topic =
      byId.get(slug) ||
      topics.find((t) => daysBetween(t.last_seen, today) <= ACTIVE_DAYS && sameStory(ct, t));
    if (!topic) {
      topic = {
        id: slug,
        name: c.name,
        aliases: [c.name],
        first_seen: today,
        last_seen: today,
        days_seen: 0,
        phase: "new",
        sources_seen: [],
        timeline: [],
        explainer: null,
        explainer_history: [],
        needs_research: false,
      };
      topics.push(topic);
      byId.set(slug, topic);
    }
    if (!topic.aliases.includes(c.name) && topic.aliases.length < 12) topic.aliases.push(c.name);
    let entry = topic.timeline.find((e) => e.date === today);
    if (!entry) {
      entry = { date: today, sources: [], signal: 0, items: [] };
      topic.timeline.push(entry);
    }
    // A same-day re-run replaces today's entry rather than stacking onto it.
    if (!touched.has(topic.id)) Object.assign(entry, { sources: [], signal: 0, items: [] });
    entry.sources = [...new Set([...entry.sources, ...c.sources])].sort();
    entry.signal += c.signal;
    for (const it of c.items) if (entry.items.length < 6) entry.items.push(it);
    // The stronger cross-feed name wins over a single-feed one.
    if (c.kind === "cluster" && topic.first_seen === today) topic.name = c.name;
    touched.add(topic.id);
  }

  for (const t of topics) {
    t.timeline = t.timeline.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-TIMELINE_MAX);
    t.last_seen = t.timeline.length ? t.timeline[t.timeline.length - 1].date : t.last_seen;
    t.days_seen = t.timeline.length;
    t.sources_seen = [...new Set(t.timeline.flatMap((e) => e.sources))].sort();
    t.phase = phaseOf(t, today);
    t.needs_research = false;
  }

  // Research queue: the strongest topics that are new, climbing again, or
  // still unexplained. Capped so one night's web budget stays bounded.
  const queue = topics
    .filter((t) => wantsResearch(t, today))
    .sort((a, b) => b.timeline[b.timeline.length - 1].signal - a.timeline[a.timeline.length - 1].signal)
    .slice(0, RESEARCH_CAP);
  for (const t of queue) t.needs_research = true;

  for (const t of topics) {
    const file = join(topicsDir, `${t.id}.json`);
    if (daysBetween(t.last_seen, today) > KEEP_DAYS) {
      if (existsSync(file)) unlinkSync(file);
      continue;
    }
    writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
  }
  return writeIndex(
    topicsDir,
    topics.filter((t) => daysBetween(t.last_seen, today) <= KEEP_DAYS),
    today,
    generated_at
  );
}
