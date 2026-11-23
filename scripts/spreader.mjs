// spreader.mjs — compact, launch-pad-ready briefing derived from latest.json.
//
// Web Pulse's job here is to be the DEEP room; the Daily Spreader shows only
// the glance. This emits data/spreader.json: a lede, up to three throughlines
// (each with a source link so every claim is checkable), and a pulse strength
// (0-100) that maps onto the launch pad's compass dots.
//
// This is the DETERMINISTIC FLOOR — same pattern as brief.mjs. It always runs
// and always produces valid JSON. The web-pulse-refresh task (a Claude session)
// then overwrites `lede` and each throughline `gist` with genuine synthesis,
// keeping citations. If that AI pass never runs, this floor still reads well.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tokenize } from "./cluster.mjs";
import { sameStory } from "./topics.mjs";

const DASHBOARD_URL = "https://nnnsightnnn.github.io/web-pulse/";
const TOPICS_URL = DASHBOARD_URL + "topics.html";

// Fresh stories lead; a story that has held the top for days still shows,
// but below anything new or climbing, so the briefing stops repeating itself.
const PHASE_WEIGHT = { new: 3, climbing: 2, holding: 1, fading: 0, closed: 0 };

// A two-feed cluster held up by a Polymarket market (a game, an election
// line) ranks below any story people are actually reading or discussing.
function weightOf({ c, topic }) {
  const human = (c.sources || []).filter((s) => s !== "polymarket").length;
  return (PHASE_WEIGHT[topic?.phase] ?? 1) - (human < 2 ? 2.5 : 0);
}

function topicFor(name, topics) {
  const t = tokenize(name || "");
  if (t.size === 0) return null;
  return (topics || []).find((e) => sameStory(t, e)) || null;
}

function topicFields(topic) {
  if (!topic) return {};
  return {
    topic_id: topic.id,
    phase: topic.phase,
    days_seen: topic.days_seen,
    first_seen: topic.first_seen,
    why: topic.summary || null,
    explainer_url: `${TOPICS_URL}#${topic.id}`,
  };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return null;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function firstItem(sources, key) {
  const s = sources?.[key];
  return s && !s.error && s.items?.length ? s.items[0] : null;
}

// Single-source fallback picks, in priority order, when the day has fewer than
// three cross-feed clusters. Each returns a throughline with a factual gist and
// a real URL so nothing is uncited.
const SINGLE_PICKS = [
  { key: "wikipedia", label: "Wikipedia", gist: (it) => `${fmtNum(it.views)} views, the day's most-read article` },
  { key: "github", label: "GitHub", gist: (it) => `${fmtNum(it.stars_today)} stars today, top of GitHub trending` },
  { key: "hackernews", label: "Hacker News", gist: (it) => `${fmtNum(it.score)} points, ${fmtNum(it.comments)} comments, leading HN` },
  { key: "product-hunt", label: "Product Hunt", gist: () => `the day's top launch` },
  { key: "steam", label: "Steam", gist: (it) => it.players ? `${fmtNum(it.players)} concurrent players` : `topping Steam tonight` },
  { key: "youtube", label: "YouTube", gist: () => `the top trending video` },
];

export function generateSpreader(latest, topicsIndex = latest.topics) {
  const topics = topicsIndex?.topics || [];
  const sources = latest.sources || {};
  const clusters = latest.clusters || [];
  const generated_at = latest.generated_at || new Date().toISOString();
  const now = new Date(generated_at);

  const liveKeys = Object.keys(sources).filter(
    (k) => !sources[k].error && (sources[k].items?.length || 0) > 0
  );
  const live = liveKeys.length;
  const total = Object.keys(sources).length;

  // ---- throughlines: clusters first (real cross-feed stories), then singles ----
  const throughlines = [];
  const usedSources = new Set();

  const ranked = clusters
    .slice(0, 8)
    .map((c, i) => ({ c, i, topic: topicFor(c.name, topics) }))
    .sort((a, b) => {
      const wa = weightOf(a), wb = weightOf(b);
      return wa !== wb ? wb - wa : a.i - b.i;
    });

  for (const { c, topic } of ranked.slice(0, 3)) {
    const rep = c.items?.find((i) => i.source !== "polymarket") || c.items?.[0] || {};
    const where = (c.sources || []).join(" + ");
    const day = topic && topic.days_seen > 1 ? ` Day ${topic.days_seen} on the feeds.` : "";
    throughlines.push({
      title: (c.name || rep.title || "Untitled").trim(),
      gist: topic?.summary || `Crossed feeds, live on ${where} at once.${day}`,
      sources: c.sources || [],
      url: rep.url || DASHBOARD_URL,
      kind: "cluster",
      ...topicFields(topic),
    });
    (c.sources || []).forEach((s) => usedSources.add(s));
  }

  for (const p of SINGLE_PICKS) {
    if (throughlines.length >= 3) break;
    if (usedSources.has(p.key)) continue;
    const it = firstItem(sources, p.key);
    if (!it) continue;
    throughlines.push({
      title: (it.title || "").trim(),
      gist: `${p.gist(it)} (${p.label}).`,
      sources: [p.key],
      url: it.url || it.hn_url || DASHBOARD_URL,
      kind: "single",
      ...topicFields(topicFor(it.title, topics)),
    });
  }

  // ---- pulse strength: how connected and how fresh was the web today? ----
  // Breadth (how many feeds the widest story reached) and freshness (how many
  // cross-feed stories are new or climbing) both count. The old formula pegged
  // at 100 whenever three clusters existed, so it stopped saying anything.
  // Rough scale: 15 scattered, ~40 one fresh two-feed story, 90+ a rare day.
  const breadth = clusters.reduce((m, c) => Math.max(m, (c.sources || []).length), 0);
  const fresh = ranked.filter((r) => r.topic && (r.topic.phase === "new" || r.topic.phase === "climbing")).length;
  const strength =
    clusters.length === 0 ? 15 : clamp(Math.round(15 + Math.max(0, breadth - 1) * 15 + Math.min(fresh, 4) * 12), 20, 100);

  // ---- lede: reuse latest.brief as the deterministic floor ----
  const lede =
    (typeof latest.brief === "string" && latest.brief.trim()) ||
    `Web Pulse pulled ${live} of ${total} sources today.`;

  return {
    date: now.toISOString().slice(0, 10),
    generated_at,
    lede,
    throughlines,
    strength,
    live_sources: live,
    total_sources: total,
    dashboard_url: DASHBOARD_URL,
    engine: "deterministic",
  };
}

// CLI: `node scripts/spreader.mjs` reads data/latest.json, writes data/spreader.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const latest = JSON.parse(readFileSync("data/latest.json", "utf8"));
  // Re-read the topic index: after the research pass it holds explainers that
  // latest.json's copy (written before research) does not.
  const idxPath = "data/topics/index.json";
  const topicsIndex = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, "utf8")) : latest.topics;
  const out = generateSpreader(latest, topicsIndex);
  writeFileSync("data/spreader.json", JSON.stringify(out, null, 2) + "\n");
  console.error(
    `  ✓ spreader.json — ${out.throughlines.length} throughlines, strength ${out.strength}, ${out.live_sources}/${out.total_sources} live`
  );
}
