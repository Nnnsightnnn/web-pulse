// Bluesky — "What's Hot" public feed via AT Protocol.
// No auth required for public feeds. The feed URI uses Bluesky's own DID.
// Note: feed URI could change if Bluesky reorganizes their generators.

export default async function fetchBluesky() {
  const feedUri = "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot"
  const url = `https://api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(feedUri)}&limit=25`

  const res = await fetch(url, {
    headers: { "User-Agent": "web-pulse/0.1" },
  })
  if (!res.ok) throw new Error(`Bluesky: HTTP ${res.status}`)
  const data = await res.json()

  return {
    source: "bluesky",
    label: "Bluesky — what's hot",
    fetched_at: new Date().toISOString(),
    items: (data.feed || []).slice(0, 25).map((entry, i) => {
      const post = entry.post
      const text = post.record?.text || ""
      const firstLine = text.split("\n")[0].slice(0, 120)
      const postId = post.uri?.split("/").pop() || ""
      const handle = post.author?.handle || ""

      return {
        rank: i + 1,
        title: firstLine,
        url: `https://bsky.app/profile/${handle}/post/${postId}`,
        author: handle,
        display_name: post.author?.displayName || "",
        likes: post.likeCount || 0,
        reposts: post.repostCount || 0,
      }
    }),
  }
}
