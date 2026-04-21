// Product Hunt — top products of the day via GraphQL API v2.
// Requires PH_API_TOKEN (Developer Token).
// Gracefully returns configured:false when token is missing.

export default async function fetchProductHunt() {
  const token = process.env.PH_API_TOKEN
  if (!token) {
    return {
      source: "product-hunt",
      label: "Product Hunt \u2014 top products",
      fetched_at: new Date().toISOString(),
      configured: false,
      message: "Set PH_API_TOKEN in .env to enable. Get a Developer Token at https://www.producthunt.com/v2/oauth/applications.",
      items: [],
    }
  }

  const query = `{
    posts(order: VOTES, first: 25) {
      edges {
        node {
          name
          tagline
          url
          votesCount
          commentsCount
        }
      }
    }
  }`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "web-pulse/0.1",
    },
    body: JSON.stringify({ query }),
    signal: controller.signal,
  })
  clearTimeout(timer)
  if (!res.ok) throw new Error(`Product Hunt: HTTP ${res.status}`)
  const data = await res.json()

  if (data.errors) throw new Error(`Product Hunt: ${data.errors[0]?.message || "GraphQL error"}`)

  const edges = data.data?.posts?.edges || []

  return {
    source: "product-hunt",
    label: "Product Hunt \u2014 top products",
    fetched_at: new Date().toISOString(),
    configured: true,
    items: edges.map((e, i) => ({
      rank: i + 1,
      title: e.node.name,
      url: e.node.url,
      tagline: e.node.tagline || "",
      votes_count: e.node.votesCount || 0,
      comments_count: e.node.commentsCount || 0,
    })),
  }
}
