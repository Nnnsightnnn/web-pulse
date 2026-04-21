// GDELT — global news events from the last 24 hours.
// Free API, no key required. Returns English-language articles sorted by relevance.
// We fetch extra articles and deduplicate by domain to avoid AP/Reuters reprints.

function decodeHtml(s) {
  return (s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

export default async function fetchGdelt() {
  const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:eng&mode=ArtList&format=json&timespan=24H&maxrecords=75&sort=HybridRel"

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  const res = await fetch(url, {
    headers: { "User-Agent": "web-pulse/0.1" },
    signal: controller.signal,
  })
  clearTimeout(timer)
  if (!res.ok) throw new Error(`GDELT: HTTP ${res.status}`)
  const data = await res.json()

  const articles = data.articles || []

  // Deduplicate by domain — keep highest-relevance article per domain
  const byDomain = new Map()
  for (const art of articles) {
    const domain = art.domain || new URL(art.url).hostname
    if (!byDomain.has(domain)) {
      byDomain.set(domain, art)
    }
  }

  const deduped = [...byDomain.values()].slice(0, 25)

  return {
    source: "gdelt",
    label: "GDELT — global news",
    fetched_at: new Date().toISOString(),
    items: deduped.map((art, i) => ({
      rank: i + 1,
      title: decodeHtml(art.title),
      url: art.url,
      domain: art.domain,
      source_country: art.sourcecountry,
    })),
  }
}
