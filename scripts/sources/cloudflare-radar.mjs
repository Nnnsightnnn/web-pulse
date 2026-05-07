// Cloudflare Radar — top trending domains globally, with 7d rank delta.
// Requires a free API token from https://dash.cloudflare.com/profile/api-tokens
// (use the "Radar - Read" template). Store it in .env as CF_RADAR_TOKEN.
//
// We make TWO calls to /radar/ranking/top:
//   1. today's ranking (no `date` param — Radar uses its latest available)
//   2. snapshot from 7 days ago via `date=YYYY-MM-DD`
// then diff each domain's rank to surface week-over-week movement.
//
// Token is read inside the function (not at module top) so the .env loader
// has a chance to populate process.env first.

const ENDPOINT = "https://api.cloudflare.com/client/v4/radar/ranking/top"

function isoDaysAgo(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

async function fetchRanking(token, params) {
  const qs = new URLSearchParams(params)
  const res = await fetch(`${ENDPOINT}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Cloudflare Radar: HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`)
  }
  const json = await res.json()
  return json.result?.top_0 || []
}

export default async function fetchCloudflareRadar() {
  const TOKEN = process.env.CF_RADAR_TOKEN

  if (!TOKEN) {
    return {
      source: "cloudflare-radar",
      label: "Cloudflare Radar — trending domains",
      fetched_at: new Date().toISOString(),
      configured: false,
      message: "Set CF_RADAR_TOKEN in .env to enable. Free token at https://dash.cloudflare.com/profile/api-tokens (Radar - Read template).",
      items: [],
    }
  }

  // Fetch current and 7d-ago in parallel. If the historical call fails we
  // gracefully degrade to a delta-less list rather than failing the whole tile.
  const [current, weekAgo] = await Promise.all([
    fetchRanking(TOKEN, { limit: "25" }),
    fetchRanking(TOKEN, { limit: "100", date: isoDaysAgo(7) }).catch((err) => {
      console.warn(`  ⚠ Cloudflare Radar 7d snapshot failed: ${err.message}`)
      return []
    }),
  ])

  const prevRank = new Map(weekAgo.map((d) => [d.domain, d.rank]))

  return {
    source: "cloudflare-radar",
    label: "Cloudflare Radar — top domains",
    fetched_at: new Date().toISOString(),
    configured: true,
    items: current.slice(0, 25).map((d, i) => {
      const rank = d.rank ?? i + 1
      const prev = prevRank.get(d.domain) ?? null
      const delta = prev != null ? prev - rank : null // positive = climbed
      return {
        rank,
        title: d.domain,
        url: `https://${d.domain}`,
        category: d.categories?.[0]?.name || null,
        rank_delta_7d: delta,
        prev_rank_7d: prev,
        is_new_to_top: prev == null,
      }
    }),
  }
}
