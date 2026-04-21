// Google Trends — daily trending searches.
// The old /api/dailytrends JSON endpoint was retired; the RSS feed still works.
// We aggregate a handful of countries to approximate "global."
//
// If Google renames this feed, every source in this project would be exposed to
// the same risk — it's a thin public surface. The fallback is serpapi's paid feed.

const COUNTRIES = [
  { geo: "US", label: "United States" },
  { geo: "GB", label: "United Kingdom" },
  { geo: "IN", label: "India" },
  { geo: "JP", label: "Japan" },
  { geo: "BR", label: "Brazil" },
  { geo: "DE", label: "Germany" },
];

function decodeHtml(s) {
  return (s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseRss(xml, geo) {
  // Parse <item>...</item> blocks. Intentionally regex-based to keep deps thin.
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml))) {
    const body = m[1];
    const title = decodeHtml(body.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim();
    const traffic = decodeHtml(body.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1] || "").trim();
    const pubDate = body.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || "";

    // First news item becomes the "story link"
    const newsTitle = decodeHtml(body.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1] || "").trim();
    const newsUrl = body.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1]?.trim() || "";
    const newsSource = decodeHtml(body.match(/<ht:news_item_source>([\s\S]*?)<\/ht:news_item_source>/)?.[1] || "").trim();

    if (title) items.push({ title, traffic, pubDate, newsTitle, newsUrl, newsSource, geo });
  }
  return items;
}

async function fetchCountry(geo) {
  const url = `https://trends.google.com/trending/rss?geo=${geo}`;
  const res = await fetch(url, { headers: { "User-Agent": "web-pulse/0.1" } });
  if (!res.ok) throw new Error(`Google Trends ${geo}: HTTP ${res.status}`);
  return parseRss(await res.text(), geo);
}

export default async function fetchGoogleTrends() {
  const results = await Promise.allSettled(COUNTRIES.map((c) => fetchCountry(c.geo)));

  // Merge by title (lowercased) — terms that trend in multiple countries rank higher.
  const bucket = new Map();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const it of r.value) {
      const key = it.title.toLowerCase();
      if (!bucket.has(key)) {
        bucket.set(key, { title: it.title, geos: new Set(), traffic: 0, items: [] });
      }
      const b = bucket.get(key);
      b.geos.add(it.geo);
      // approx_traffic looks like "500+", "50K+", "2M+" — parse loosely
      const num = parseTraffic(it.traffic);
      b.traffic += num;
      b.items.push(it);
    }
  }

  const merged = [...bucket.values()]
    .map((b) => {
      const lead = b.items[0];
      return {
        title: b.title,
        geos: [...b.geos].sort(),
        traffic_estimate: b.traffic,
        news_title: lead.newsTitle,
        news_url: lead.newsUrl,
        news_source: lead.newsSource,
      };
    })
    .sort((a, b) => {
      // Multi-country trends first, then by traffic.
      if (b.geos.length !== a.geos.length) return b.geos.length - a.geos.length;
      return b.traffic_estimate - a.traffic_estimate;
    })
    .slice(0, 25)
    .map((it, i) => ({ rank: i + 1, ...it }));

  return {
    source: "google-trends",
    label: "Google Trends — trending searches",
    fetched_at: new Date().toISOString(),
    countries: COUNTRIES.map((c) => c.geo),
    items: merged,
  };
}

function parseTraffic(s) {
  if (!s) return 0;
  const m = s.match(/([\d.]+)\s*([KMB]?)\+?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const mul = { "": 1, K: 1_000, M: 1_000_000, B: 1_000_000_000 }[m[2].toUpperCase()] || 1;
  return Math.round(n * mul);
}
