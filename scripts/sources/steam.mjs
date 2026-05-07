// Steam — top games by 24h peak concurrent players via the official
// ISteamChartsService API. No key required.
//
// Endpoint:  https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/
// Returns:   { response: { ranks: [{ rank, appid, last_week_rank, peak_in_game }, …] } }
//
// We resolve appid -> name via the Steam storefront's appdetails endpoint in
// parallel. last_week_rank gives us a free week-over-week rank delta.

const CHARTS = "https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/?format=json"
const APPDETAILS = (appid) =>
  `https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`

const TOP_N = 25

async function resolveName(appid) {
  try {
    const res = await fetch(APPDETAILS(appid), {
      headers: { "User-Agent": "web-pulse/0.1" },
    })
    if (!res.ok) return null
    const json = await res.json()
    const entry = json[String(appid)]
    return entry?.success ? entry.data?.name ?? null : null
  } catch {
    return null
  }
}

export default async function fetchSteam() {
  const res = await fetch(CHARTS, { headers: { "User-Agent": "web-pulse/0.1" } })
  if (!res.ok) throw new Error(`Steam: HTTP ${res.status}`)
  const json = await res.json()

  const ranks = (json.response?.ranks || []).slice(0, TOP_N)
  if (!ranks.length) throw new Error("Steam: empty ranks array")

  // Resolve names in parallel. If a lookup fails we fall back to "App {appid}"
  // so the row still renders something useful.
  const names = await Promise.all(ranks.map((r) => resolveName(r.appid)))

  return {
    source: "steam",
    label: "Steam — top games (24h peak)",
    fetched_at: new Date().toISOString(),
    items: ranks.map((r, i) => {
      const name = names[i] || `App ${r.appid}`
      const lastWeek = r.last_week_rank
      // last_week_rank=0 in the API means "wasn't in the chart last week"
      const isNew = !lastWeek || lastWeek <= 0
      const rankDelta = isNew ? null : lastWeek - r.rank // positive = climbed
      return {
        rank: r.rank,
        title: name,
        url: `https://store.steampowered.com/app/${r.appid}`,
        appid: r.appid,
        players: r.peak_in_game ?? 0, // 24h peak concurrent
        peak_24h: r.peak_in_game ?? 0,
        last_week_rank: lastWeek ?? null,
        rank_delta_7d: rankDelta,
        is_new_to_chart: isNew,
      }
    }),
  }
}
