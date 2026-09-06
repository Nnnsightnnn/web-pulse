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

import { readFileSync, writeFileSync } from "node:fs";

const DASHBOARD_URL = "https://nnnsightnnn.github.io/web-pulse/";

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
  { key: "wikipedia", label: "Wikipedia", gist: (it) => `${fmtNum(it.views)} views — the day's most-read article` },
  { key: "github", label: "GitHub", gist: (it) => `${fmtNum(it.stars_today)} stars today — top of GitHub trending` },
  { key: "hackernews", label: "Hacker News", gist: (it) => `${fmtNum(it.score)} points, ${fmtNum(it.comments)} comments — leading HN` },
  { key: "product-hunt", label: "Product Hunt", gist: () => `the day's top launch` },
  { key: "steam", label: "Steam", gist: (it) => it.players ? `${fmtNum(it.players)} concurrent players` : `topping Steam tonight` },
  { key: "polymarket", label: "Polymarket", gist: () => `the most-traded prediction market` },
  { key: "youtube", label: "YouTube", gist: () => `the top trending video` },
];

export function generateSpreader(latest) {
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

  for (const c of clusters.slice(0, 3)) {
    const rep = c.items?.[0] || {};
    const where = (c.sources || []).join(" + ");
    throughlines.push({
      title: (c.name || rep.title || "Untitled").trim(),
      gist: `Crossed feeds — live on ${where} at once.`,
      sources: c.sources || [],
      url: rep.url || DASHBOARD_URL,
      kind: "cluster",
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
    });
  }

  // ---- pulse strength: how connected was the web today? ----
  // Cross-feed agreement is the signal; a scattered day reads low.
  const topScore = clusters[0]?.score || 0;
  let strength;
  if (clusters.length === 0) {
    strength = 15; // every feed ran its own story
  } else {
    strength = clamp(Math.round(clusters.length * 22 + topScore * 45), 20, 100);
  }

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
  const out = generateSpreader(latest);
  writeFileSync("data/spreader.json", JSON.stringify(out, null, 2) + "\n");
  console.error(
    `  ✓ spreader.json — ${out.throughlines.length} throughlines, strength ${out.strength}, ${out.live_sources}/${out.total_sources} live`
  );
}
