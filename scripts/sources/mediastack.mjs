// Mediastack — global news headlines from the last 24 hours.
// Requires MEDIASTACK_API_KEY (free tier: 500 req/month, HTTP only).
// Gracefully returns configured:false when key is missing.

function decodeHtml(s) {
  return (s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

export default async function fetchMediastack() {
  const key = process.env.MEDIASTACK_API_KEY
  if (!key) {
    return {
      source: "mediastack",
      label: "Mediastack \u2014 global news",
      fetched_at: new Date().toISOString(),
      configured: false,
      message: "Set MEDIASTACK_API_KEY in .env to enable. Free key at https://mediastack.com/signup/free.",
      items: [],
    }
  }

  const url = `http://api.mediastack.com/v1/news?access_key=${key}&languages=en&limit=25&sort=published_desc`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  const res = await fetch(url, {
    headers: { "User-Agent": "web-pulse/0.1" },
    signal: controller.signal,
  })
  clearTimeout(timer)
  if (!res.ok) throw new Error(`Mediastack: HTTP ${res.status}`)
  const data = await res.json()

  if (data.error) throw new Error(`Mediastack: ${data.error.message || data.error.code}`)

  const articles = data.data || []

  return {
    source: "mediastack",
    label: "Mediastack \u2014 global news",
    fetched_at: new Date().toISOString(),
    configured: true,
    items: articles.map((art, i) => ({
      rank: i + 1,
      title: decodeHtml(art.title),
      url: art.url,
      source_name: art.source || "",
      country: art.country || "",
      category: art.category || "",
    })),
  }
}
