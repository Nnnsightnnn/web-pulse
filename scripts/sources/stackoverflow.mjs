// Stack Overflow — hot questions from the StackExchange API.
// Free, no key needed for low-volume usage (300 req/day unauth).

function decodeHtml(s) {
  return (s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

export default async function fetchStackOverflow() {
  let url = "https://api.stackexchange.com/2.3/questions?order=desc&sort=hot&site=stackoverflow&pagesize=25"

  // Optional API key for higher rate limits
  const key = process.env.SO_API_KEY
  if (key) url += `&key=${key}`

  const res = await fetch(url, {
    headers: { "User-Agent": "web-pulse/0.1" },
  })
  if (!res.ok) throw new Error(`Stack Overflow: HTTP ${res.status}`)
  const data = await res.json()

  return {
    source: "stackoverflow",
    label: "Stack Overflow — hot questions",
    fetched_at: new Date().toISOString(),
    items: (data.items || []).slice(0, 25).map((q, i) => ({
      rank: i + 1,
      title: decodeHtml(q.title),
      url: q.link,
      score: q.score,
      answers: q.answer_count,
      views: q.view_count,
      tags: q.tags || [],
    })),
  }
}
