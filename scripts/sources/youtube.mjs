// YouTube — trending videos via YouTube Data API v3.
// Requires YT_API_KEY env var (free, 10k units/day quota, 1 unit per call).
// Gracefully degrades if no key is set.

function decodeHtml(s) {
  return (s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

export default async function fetchYouTube() {
  const KEY = process.env.YT_API_KEY

  if (!KEY) {
    return {
      source: "youtube",
      label: "YouTube — trending videos",
      fetched_at: new Date().toISOString(),
      configured: false,
      message: "Set YT_API_KEY in .env to enable. Free key at https://console.cloud.google.com/apis/credentials (enable YouTube Data API v3).",
      items: [],
    }
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=25&key=${KEY}`

  const res = await fetch(url, {
    headers: { "User-Agent": "web-pulse/0.1" },
  })
  if (!res.ok) throw new Error(`YouTube: HTTP ${res.status}`)
  const data = await res.json()

  return {
    source: "youtube",
    label: "YouTube — trending videos",
    fetched_at: new Date().toISOString(),
    configured: true,
    items: (data.items || []).slice(0, 25).map((v, i) => ({
      rank: i + 1,
      title: decodeHtml(v.snippet?.title || ""),
      url: `https://www.youtube.com/watch?v=${v.id}`,
      channel: v.snippet?.channelTitle || "",
      views: Number(v.statistics?.viewCount) || 0,
      likes: Number(v.statistics?.likeCount) || 0,
    })),
  }
}
