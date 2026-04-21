// Mastodon — trending posts from mastodon.social.
// Public API, no authentication needed.

function stripHtml(html) {
  return (html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

export default async function fetchMastodonTrending() {
  const url = "https://mastodon.social/api/v1/trends/statuses?limit=25"

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  const res = await fetch(url, {
    headers: { "User-Agent": "web-pulse/0.1" },
    signal: controller.signal,
  })
  clearTimeout(timer)
  if (!res.ok) throw new Error(`Mastodon: HTTP ${res.status}`)
  const statuses = await res.json()

  return {
    source: "mastodon-trending",
    label: "Mastodon \u2014 trending posts",
    fetched_at: new Date().toISOString(),
    items: statuses.slice(0, 25).map((s, i) => {
      const text = stripHtml(s.content)
      return {
        rank: i + 1,
        title: text.length > 120 ? text.slice(0, 117) + "\u2026" : text || "[media]",
        url: s.url,
        author: s.account?.display_name || s.account?.acct || "",
        likes: s.favourites_count || 0,
        boosts: s.reblogs_count || 0,
      }
    }),
  }
}
